import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { expect } from "chai";

describe("Token", () => {
    let owner: Signer;
    let token: Contract;

    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("Token");

        token = await Token.deploy("My Test Token", "TSTTKN", 31337);
        await token.deployed();
    });

    it("sets name and symbol when created", async () => {
        expect(await token.name()).to.equal("My Test Token");
        expect(await token.symbol()).to.equal("TSTTKN");
    });

    it("mints initialSupply to msg.sender when created", async () => {
        expect(await token.totalSupply()).to.equal(31337);
        expect(await token.balanceOf(owner.getAddress())).to.equal(31337);
    });
});
