//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IFactory.sol";
import "../interfaces/IExchange.sol";

contract Exchange is ERC20 {
    address public tokenAddress;
    address public factoryAddress;
    uint256 public feeInPoints = 100; // point = 1/100 of 1%

    event TokenPurchase(
        address indexed buyer,
        uint256 indexed ethSold,
        uint256 tokensBought
    );
    event EthPurchase(
        address indexed buyer,
        uint256 indexed tokensSold,
        uint256 ethBought
    );

    event AddLiquidity(
        address indexed provider,
        uint256 indexed ethAmount,
        uint256 indexed tokenAmount
    );

    event RemoveLiquidity(
        address indexed provider,
        uint256 indexed lpRemovedAmount,
        uint256 ethAmount,
        uint256 tokenAmount
    );

    event TokenToTokenPurchase(
        address indexed buyer,
        address indexed tokenAddress,
        uint256 indexed tokensSold,
        uint256 tokensBought
    );

    constructor(address _token)
        ERC20(
            concat(IERC20Metadata(_token).name(), "-Eth"),
            concat(IERC20Metadata(_token).symbol(), "_LP")
        )
    {
        require(_token != address(0), "Token address is not valid");
        factoryAddress = msg.sender;
        tokenAddress = _token;
    }

    function addLiquidity(uint256 _amount) public payable returns (uint256) {
        if (getReserve() == 0) {
            IERC20 token = IERC20(tokenAddress);
            token.transferFrom(msg.sender, address(this), _amount);

            uint256 liquidity = address(this).balance;
            _mint(msg.sender, liquidity);

            emit AddLiquidity(msg.sender, msg.value, _amount);

            return liquidity;
        } else {
            uint256 ethReserve = address(this).balance - msg.value;
            uint256 tokenReserve = getReserve();
            uint256 tokenAmount = (msg.value * tokenReserve) / ethReserve;
            require(_amount >= tokenAmount, "insufficient token amount");

            IERC20 token = IERC20(tokenAddress);
            token.transferFrom(msg.sender, address(this), tokenAmount);

            uint256 liquidity = (totalSupply() * msg.value) / ethReserve;
            _mint(msg.sender, liquidity);

            emit AddLiquidity(msg.sender, msg.value, _amount);

            return liquidity;
        }
    }

    function getReserve() public view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    function ethToTokenSwap(uint256 _minTokens) public payable {
        ethToToken(_minTokens, msg.sender);
    }

    function ethToToken(uint256 _minTokens, address recipient)
        public
        payable
        returns (uint256)
    {
        uint256 tokenReserve = getReserve();
        uint256 totalTokensBought = getAmount(
            msg.value,
            address(this).balance - msg.value,
            tokenReserve,
            feeInPoints
        );

        require(totalTokensBought >= _minTokens, "insufficient output total");

        IERC20(tokenAddress).transfer(recipient, totalTokensBought);

        emit TokenPurchase(msg.sender, msg.value, totalTokensBought);

        return totalTokensBought;
    }

    function tokenToEthSwap(uint256 _tokensSold, uint256 _minEth) public {
        uint256 tokenReserve = getReserve();
        uint256 ethBought = getAmount(
            _tokensSold,
            tokenReserve,
            address(this).balance,
            feeInPoints
        );

        require(ethBought >= _minEth, "insufficient output amount");

        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokensSold
        );

        payable(msg.sender).transfer(ethBought);

        emit EthPurchase(msg.sender, _tokensSold, ethBought);
    }

    function tokenToTokenSwap(
        uint256 _tokensSold,
        uint256 _minTokensBought,
        address _tokenBoughtAddress
    ) public {
        address exchangeAddress = IFactory(factoryAddress).getExchange(
            _tokenBoughtAddress
        );

        require(
            exchangeAddress != address(this) && exchangeAddress != address(0),
            "exchange not found"
        );

        uint256 tokenReserve = getReserve();
        uint256 ethBought = getAmount(
            _tokensSold,
            tokenReserve,
            address(this).balance,
            feeInPoints
        );

        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokensSold
        );

        uint256 tokensBought = IExchange(exchangeAddress).ethToToken{
            value: ethBought
        }(_minTokensBought, msg.sender);

        emit TokenToTokenPurchase(
            msg.sender,
            _tokenBoughtAddress,
            _tokensSold,
            tokensBought
        );
    }

    function getEthAmount(uint256 _tokenSold) public view returns (uint256) {
        require(_tokenSold > 0, "tokenSold is too small");

        uint256 tokenReserve = getReserve();

        return
            getAmount(
                _tokenSold,
                tokenReserve,
                address(this).balance,
                feeInPoints
            );
    }

    function getTokenAmount(uint256 _ethSold) public view returns (uint256) {
        require(_ethSold > 0, "ethSold should be more than 0");
        uint256 tokenReserve = getReserve();

        return
            getAmount(
                _ethSold,
                address(this).balance,
                tokenReserve,
                feeInPoints
            );
    }

    function getTokenToTokenAmount(
        uint256 _tokensSold,
        address _tokenBoughtAddress
    ) public view returns (uint256) {
        address exchangeAddress = IFactory(factoryAddress).getExchange(
            _tokenBoughtAddress
        );

        require(
            exchangeAddress != address(this) && exchangeAddress != address(0),
            "exchange not found"
        );

        uint256 tokenReserve = getReserve();
        uint256 ethBought = getAmount(
            _tokensSold,
            tokenReserve,
            address(this).balance,
            feeInPoints
        );

        uint256 tokensBought = IExchange(exchangeAddress).getTokenAmount(
            ethBought
        );

        return tokensBought;
    }

    function getAmount(
        uint256 _inputAmount,
        uint256 _inputReserve,
        uint256 _outputReserve,
        uint256 _feeInPoints
    ) private pure returns (uint256) {
        require(_inputReserve > 0 && _outputReserve > 0, "invalid reserves");

        uint256 inputAmountWithFee = _inputAmount * (10000 - _feeInPoints);
        uint256 numerator = inputAmountWithFee * _outputReserve;
        uint256 denominator = (_inputReserve * 10000) + inputAmountWithFee;

        return numerator / denominator;
    }

    function removeLiquidity(uint256 _amount)
        public
        returns (uint256, uint256)
    {
        require(_amount > 0, "invalid amount");

        uint256 ethAmount = (address(this).balance * _amount) / totalSupply();
        uint256 tokenAmount = (getReserve() * _amount) / totalSupply();

        _burn(msg.sender, _amount);
        payable(msg.sender).transfer(ethAmount);
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);

        emit RemoveLiquidity(msg.sender, _amount, ethAmount, tokenAmount);

        return (ethAmount, tokenAmount);
    }

    function concat(string memory a, string memory b)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(a, b));
    }
}
