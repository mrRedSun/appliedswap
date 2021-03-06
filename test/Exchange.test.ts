const { expect } = require("chai");
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber, Contract } from "ethers";
import { ethers, network } from "hardhat";
import { Factory__factory } from "../typechain";

const toWei = (value: BigNumber | number) =>
    ethers.utils.parseEther(value.toString());

const fromWei = (value: string | BigNumber | number) =>
    ethers.utils.formatEther(
        typeof value === "string" ? value : value.toString()
    );

const getBalance = ethers.provider.getBalance;

const createExchange = async (
    factory: any,
    tokenAddress: string,
    sender: Signer
) => {
    const exchangeAddress = await factory
        .connect(sender)
        .callStatic.createExchange(tokenAddress);

    await factory.connect(sender).createExchange(tokenAddress);

    const Exchange = await ethers.getContractFactory("Exchange");

    return await Exchange.attach(exchangeAddress);
};

describe("Exchange", () => {
    let owner: Signer;
    let user: Signer;
    let exchange: Contract;
    let token: Contract;

    beforeEach(async () => {
        network.provider.request({
            method: "hardhat_reset",
        });

        //reset network to reset wallet balances

        [owner, user] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("Token");
        token = await Token.deploy("Token", "TKN", toWei(1000000));
        await token.deployed();

        const Exchange = await ethers.getContractFactory("Exchange");
        exchange = await Exchange.deploy(token.address);
        await exchange.deployed();
    });

    it("is deployed", async () => {
        expect(await exchange.deployed()).to.equal(exchange);
    });

    describe("addLiquidity", async () => {
        it("adds liquidity", async () => {
            await token.approve(exchange.address, toWei(200));
            await exchange.addLiquidity(toWei(200), { value: toWei(100) });

            expect(await getBalance(exchange.address)).to.equal(toWei(100));
            expect(await exchange.getReserve()).to.equal(toWei(200));
        });

        it("allows zero amounts", async () => {
            await token.approve(exchange.address, 0);
            await exchange.addLiquidity(0, { value: 0 });

            expect(await getBalance(exchange.address)).to.equal(0);
            expect(await exchange.getReserve()).to.equal(0);
        });
    });

    describe("getTokenAmount", async () => {
        it("returns correct token amount", async () => {
            await token.approve(exchange.address, toWei(20000));
            await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });

            let tokensOut = await exchange.getTokenAmount(toWei(1));
            expect(fromWei(tokensOut)).to.equal("1.978041738678708079");

            tokensOut = await exchange.getTokenAmount(toWei(100));
            expect(fromWei(tokensOut)).to.equal("180.1637852593266606");

            tokensOut = await exchange.getTokenAmount(toWei(1000));
            expect(fromWei(tokensOut)).to.equal("994.974874371859296482");
        });
    });

    describe("getEthAmount", async () => {
        it("returns correct ether amount", async () => {
            await token.approve(exchange.address, toWei(2000));
            await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });

            let ethOut = await exchange.getEthAmount(toWei(2));
            expect(fromWei(ethOut)).to.equal("0.989020869339354039");

            ethOut = await exchange.getEthAmount(toWei(100));
            expect(fromWei(ethOut)).to.equal("47.16531681753215817");

            ethOut = await exchange.getEthAmount(toWei(2000));
            expect(fromWei(ethOut)).to.equal("497.487437185929648241");
        });
    });

    describe("ethToTokenSwap", async () => {
        beforeEach(async () => {
            await token.approve(exchange.address, toWei(2000));
            await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });
        });

        it("transfers at least min amount of tokens", async () => {
            const userBalanceBefore = await getBalance(user.getAddress());

            await exchange
                .connect(user)
                .ethToTokenSwap(toWei(1.5), { value: toWei(1) });

            const userBalanceAfter = await getBalance(user.getAddress());
            expect(fromWei(userBalanceAfter.sub(userBalanceBefore))).to.equal(
                "-1.000100739389490045"
            );

            const userTokenBalance = await token.balanceOf(user.getAddress());
            expect(fromWei(userTokenBalance)).to.equal("1.978041738678708079");

            const exchangeEthBalance = await getBalance(exchange.address);
            expect(fromWei(exchangeEthBalance)).to.equal("1001.0");

            const exchangeTokenBalance = await token.balanceOf(
                exchange.address
            );
            expect(fromWei(exchangeTokenBalance)).to.equal(
                "1998.021958261321291921"
            );
        });

        it("fails when output amount is less than min amount", async () => {
            await expect(
                exchange
                    .connect(user)
                    .ethToTokenSwap(toWei(2), { value: toWei(1) })
            ).to.be.revertedWith("insufficient output total");
        });

        it("allows zero swaps", async () => {
            await exchange
                .connect(user)
                .ethToTokenSwap(toWei(0), { value: toWei(0) });

            const userTokenBalance = await token.balanceOf(user.getAddress());
            expect(fromWei(userTokenBalance)).to.equal("0.0");

            const exchangeEthBalance = await getBalance(exchange.address);
            expect(fromWei(exchangeEthBalance)).to.equal("1000.0");

            const exchangeTokenBalance = await token.balanceOf(
                exchange.address
            );
            expect(fromWei(exchangeTokenBalance)).to.equal("2000.0");
        });
    });

    describe("tokenToEthSwap", async () => {
        beforeEach(async () => {
            await token.transfer(user.getAddress(), toWei(2));
            await token.connect(user).approve(exchange.address, toWei(2));

            await token.approve(exchange.address, toWei(2000));
            await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });
        });

        it("transfers at least min amount of tokens", async () => {
            const userBalanceBefore = await getBalance(user.getAddress());

            await exchange.connect(user).tokenToEthSwap(toWei(2), toWei(0.9));

            const userBalanceAfter = await getBalance(user.getAddress());
            expect(fromWei(userBalanceAfter.sub(userBalanceBefore))).to.equal(
                "0.988944981129850816"
            );

            const userTokenBalance = await token.balanceOf(user.getAddress());
            expect(fromWei(userTokenBalance)).to.equal("0.0");

            const exchangeEthBalance = await getBalance(exchange.address);
            expect(fromWei(exchangeEthBalance)).to.equal(
                "999.010979130660645961"
            );

            const exchangeTokenBalance = await token.balanceOf(
                exchange.address
            );
            expect(fromWei(exchangeTokenBalance)).to.equal("2002.0");
        });

        it("fails when output amount is less than min amount", async () => {
            await expect(
                exchange.connect(user).tokenToEthSwap(toWei(2), toWei(1.0))
            ).to.be.revertedWith("insufficient output amount");
        });

        it("allows zero swaps", async () => {
            await exchange.connect(user).tokenToEthSwap(toWei(0), toWei(0));

            const userBalance = await getBalance(user.getAddress());
            expect(fromWei(userBalance)).to.equal("9999.999856572716173585");

            const userTokenBalance = await token.balanceOf(user.getAddress());
            expect(fromWei(userTokenBalance)).to.equal("2.0");

            const exchangeEthBalance = await getBalance(exchange.address);
            expect(fromWei(exchangeEthBalance)).to.equal("1000.0");

            const exchangeTokenBalance = await token.balanceOf(
                exchange.address
            );
            expect(fromWei(exchangeTokenBalance)).to.equal("2000.0");
        });
    });

    describe("tokenToTokenSwap", async () => {
        it("swaps token for token", async () => {
            const Factory = await ethers.getContractFactory("Factory");
            const Token = await ethers.getContractFactory("Token");

            const factory = await Factory.deploy();
            const token = await Token.deploy("TokenA", "AAA", toWei(1000000));
            const token2 = await Token.connect(user).deploy(
                "TokenB",
                "BBBB",
                toWei(1000000)
            );

            await factory.deployed();
            await token.deployed();
            await token2.deployed();

            const exchange = await createExchange(
                factory,
                token.address,
                owner
            );
            const exchange2 = await createExchange(
                factory,
                token2.address,
                user
            );

            await token.approve(exchange.address, toWei(2000));
            await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });

            await token2.connect(user).approve(exchange2.address, toWei(1000));
            await exchange2
                .connect(user)
                .addLiquidity(toWei(1000), { value: toWei(1000) });

            expect(await token2.balanceOf(await owner.getAddress())).to.equal(
                0
            );

            await token.approve(exchange.address, toWei(10));
            const tokensExpected = await exchange.getTokenToTokenAmount(
                toWei(10),
                token2.address
            );

            await exchange.tokenToTokenSwap(
                toWei(10),
                toWei(4.8),
                token2.address
            );

            expect(
                fromWei(await token2.balanceOf(await owner.getAddress()))
            ).to.equal(fromWei(tokensExpected));

            expect(await token.balanceOf(await user.getAddress())).to.equal(0);

            await token2.connect(user).approve(exchange2.address, toWei(10));
            await exchange2
                .connect(user)
                .tokenToTokenSwap(toWei(10), toWei(19.6), token.address);

            expect(
                fromWei(await token.balanceOf(await user.getAddress()))
            ).to.equal("19.602080509528011079");
        });
    });
});
