//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IExchange {
    function ethToTokenSwap(uint256 _minTokens) external payable;

    function ethToToken(uint256 _minTokens, address recipient) external payable;
}
