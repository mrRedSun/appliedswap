//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Exchange.sol";
import "../interfaces/IFactory.sol";

contract Factory is IFactory {
    mapping(address => address) public tokenToExchange;

    function createExchange(address _tokenAddress) public returns (address) {
        require(_tokenAddress != address(0), "invalid token address");
        require(
            tokenToExchange[_tokenAddress] == address(0),
            "exchange already exists"
        );

        address exchangeAddress = address(new Exchange(_tokenAddress));
        tokenToExchange[_tokenAddress] = exchangeAddress;

        return exchangeAddress;
    }

    function getExchange(address _tokenAddress)
        public
        view
        override
        returns (address)
    {
        return tokenToExchange[_tokenAddress];
    }
}
