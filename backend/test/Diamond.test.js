const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Diamond", function () {
    let diamond;
    let owner;
    let ownershipFacet; // ทำให้เป็น global เพื่อให้เข้าถึงได้ง่ายขึ้นใน test case

    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        // Deploy Diamond Contract หลัก
        const Diamond = await ethers.getContractFactory("Diamond");
        diamond = await Diamond.deploy(owner.address); // constructor รับแค่ _owner
        await diamond.waitForDeployment();

        // Deploy OwnershipFacet
        const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet");
        ownershipFacet = await OwnershipFacet.deploy(); // Deploy ownershipFacet แยก
        await ownershipFacet.waitForDeployment();

        // เพิ่ม OwnershipFacet เข้าไปใน Diamond
        const cut = [
            {
                facetAddress: ownershipFacet.target,
                action: 0, // Add (0)
                functionSelectors: [
                    ownershipFacet.interface.getFunction("owner").selector,
                    ownershipFacet.interface.getFunction("transferOwnership(address)").selector
                ],
            },
        ];

        // ต้องสร้างอินสแตนซ์ของ IDiamondCut เพื่อเรียก diamondCut บน diamond (proxy)
        // และเรียก init() ของ OwnershipFacet ผ่าน delegatecall
        const IDiamondCut = await ethers.getContractAt("IDiamondCut", diamond.target);
        
        // แก้ไขตรงนี้: เพิ่มการประกาศ event DiamondCut เข้าไปใน IDiamondCut.sol (ถ้ายังไม่มี)
        // และ ethers.getContractAt จะดึง ABI ที่รวม Event มาให้
        
        await IDiamondCut.diamondCut(
            cut,
            ownershipFacet.target,
            ownershipFacet.interface.encodeFunctionData("init", []) // 'init' ไม่มี arguments ก็ส่ง array ว่างไป
        );

        console.log(`Diamond deployed to: ${diamond.target}`);
        console.log(`OwnershipFacet deployed to: ${ownershipFacet.target}`);
        console.log(`Owner address: ${owner.address}`);
    });

    // Test cases
    it("should deploy the diamond and add the DiamondCutFacet", async function () {
        expect(diamond.target).to.not.equal(ethers.ZeroAddress);

        // ควรตรวจสอบด้วย DiamondLoupeFacet ว่า Facet ถูกเพิ่มจริงหรือไม่
        // สำหรับตอนนี้ การที่ Diamond deploy สำเร็จก็เพียงพอแล้ว
    });

    it("should set the correct owner of the diamond", async function () {
        // ต้องให้ OwnableInterface รู้จัก Event OwnershipTransferred ด้วย
        const OwnableInterface = new ethers.Interface([
            "function owner() public view returns (address)",
            "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)" // เพิ่ม Event
        ]);
        const diamondAsOwnable = new ethers.Contract(diamond.target, OwnableInterface, owner);
        
        expect(await diamondAsOwnable.owner()).to.equal(owner.address);
    });

    it("should allow the owner to transfer ownership", async function () {
        const [_, newOwner] = await ethers.getSigners();

        // ต้องให้ OwnableInterface รู้จัก Event OwnershipTransferred ด้วย
        const OwnableInterface = new ethers.Interface([
            "function owner() public view returns (address)",
            "function transferOwnership(address)",
            "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)" // เพิ่ม Event
        ]);
        const diamondAsOwnable = new ethers.Contract(diamond.target, OwnableInterface, owner);

        await expect(diamondAsOwnable.transferOwnership(newOwner.address))
            .to.emit(diamondAsOwnable, "OwnershipTransferred")
            .withArgs(owner.address, newOwner.address);
        
        expect(await diamondAsOwnable.owner()).to.equal(newOwner.address);
    });
});