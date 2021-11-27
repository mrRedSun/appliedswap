import { BigNumber, ContractReceipt, ContractTransaction, Signer } from "ethers";
import { ethers } from "hardhat";

const fromWei = (value: string | BigNumber | number) =>
    ethers.utils.formatEther(typeof value === "string" ? value : value.toString());

const toWei = (value: BigNumber | number) => ethers.utils.parseEther(value.toString());

const consolidateTransactions = async (transactions: ContractTransaction[]): Promise<ContractReceipt[]> => {
    return Promise.all([...transactions.map((t) => t.wait())]);
};

const printPretty = (text: string) => console.log("\x1b[32m", text, "\x1b[0m");

async function main() {
    const Factory = await ethers.getContractFactory("Factory");
    const factory = await Factory.deploy();
    await factory.deployed();

    printPretty(`Factory deployed to ${factory.address} 🏭`);

    const Token = await ethers.getContractFactory("Token");

    // Заносимо токенізовану валюту на блокчейн та даємо собі
    // по мільйону гривень, євро, та долларів (для наукових цілей)

    const [euroToken, uahToken, usdToken] = await Promise.all(
        [
            await Token.deploy("Wrapped European Euro", "WEUR", toWei(1_000_000)),
            await Token.deploy("Wrapped UA Hryvnya", "WUAH", toWei(1_000_000)),
            await Token.deploy("Wrapped US Dollar", "WUSD", toWei(1_000_000)),
        ].map((t) => t.deployed())
    );

    printPretty("Tokens deployed 💵");

    await consolidateTransactions([
        await factory.createExchange(euroToken.address),
        await factory.createExchange(uahToken.address),
        await factory.createExchange(usdToken.address),
    ]);

    printPretty("Exchanges created 🏦");

    const Exchange = await ethers.getContractFactory("Exchange");

    const [eurExchange, uahExchange, usdExchange] = await Promise.all([
        Exchange.attach(await factory.getExchange(euroToken.address)),
        Exchange.attach(await factory.getExchange(uahToken.address)),
        Exchange.attach(await factory.getExchange(usdToken.address)),
    ]);

    await consolidateTransactions([
        await euroToken.approve(eurExchange.address, ethers.constants.MaxUint256),
        await uahToken.approve(uahExchange.address, ethers.constants.MaxUint256),
        await usdToken.approve(usdExchange.address, ethers.constants.MaxUint256),
    ]);

    const results = await consolidateTransactions([
        await eurExchange.addLiquidity(toWei(3_500), { value: toWei(1) }),
        await uahExchange.addLiquidity(toWei(110_000), { value: toWei(1) }),
        await usdExchange.addLiquidity(toWei(4_000), { value: toWei(1) }),
    ]);

    printPretty("Liquidity provided 💧");
    printPretty("Deployment done 🎉");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
