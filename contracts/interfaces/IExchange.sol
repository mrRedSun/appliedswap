//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IExchange {
    function ethToTokenSwap(uint256 _minTokens)
        external
        payable
        returns (uint256);

    function ethToToken(uint256 _minTokens, address recipient)
        external
        payable
        returns (uint256);

    function getReserve() external view returns (uint256);

    function getTokenAmount(uint256 _ethSold) external view returns (uint256);
}
