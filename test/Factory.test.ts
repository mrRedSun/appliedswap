const { expect } = require("chai");
import { Signer } from "@ethersproject/abstract-signer";
import { getAddress } from "@ethersproject/address";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { Exchange__factory } from "../typechain";

const toWei = (value: BigNumber | number) =>
    ethers.utils.parseEther(value.toString());

const fromWei = (value: string | BigNumber | number) =>
    ethers.utils.formatEther(
        typeof value === "string" ? value : value.toString()
    );

const getBalance = ethers.provider.getBalance;

describe("Factory", () => {
    let owner: Signer;
    let factory: Contract;
    let token: Contract;
    let exchangeContractFactory: Exchange__factory;

    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("Factory");

        factory = await Factory.deploy();
        await factory.deployed();
        factory.connect(owner);

        const Token = await ethers.getContractFactory("Token");

        token = await Token.deploy("Test", "TST", 10000);
        await token.deployed();

        exchangeContractFactory = await ethers.getContractFactory("Exchange");
    });

    it("creates exchange", async () => {
        await factory.createExchange(token.address);
        const exchangeAddress = await factory.tokenToExchange(token.address);
        expect(exchangeAddress).is.not.equal(ethers.constants.AddressZero);
    });

    it("doesn't allow zero address", async () => {
        await expect(
            factory.createExchange(ethers.constants.AddressZero)
        ).to.be.revertedWith("invalid token address");
    });

    it("fails when exchange exists", async () => {
        await factory.createExchange(token.address);

        await expect(factory.createExchange(token.address)).to.be.revertedWith(
            "exchange already exists"
        );
    });
    it("sets correct name and symbol when pair is created", async () => {
        await factory.createExchange(token.address);
        const exchangeAddress = await factory.tokenToExchange(token.address);
        const exchangeContract = await exchangeContractFactory.attach(
            exchangeAddress
        );

        expect(await exchangeContract.symbol()).to.be.equal("TST_LP");
        expect(await exchangeContract.name()).to.be.equal("Test-Eth");
    });
});
