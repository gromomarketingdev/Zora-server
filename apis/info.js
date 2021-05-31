const router = require("express").Router();
const { sortBy } = require("lodash");
const orderBy = require("lodash.orderby");
const mongoose = require("mongoose");
const ERC721TOKEN = mongoose.model("ERC721TOKEN");
const ERC721CONTRACT = mongoose.model("ERC721CONTRACT");
const ERC1155CONTRACT = mongoose.model("ERC1155CONTRACT");
const ERC1155TOKEN = mongoose.model("ERC1155TOKEN");
const Collection = mongoose.model("Collection");
const Auction = mongoose.model("Auction");
const Account = mongoose.model("Account");
const ERC1155HOLDING = mongoose.model("ERC1155HOLDING");
const Category = mongoose.model("Category");

const toLowerCase = require("../utils/utils");
const auth = require("./middleware/auth");

// list the newly minted 10 tokens
router.get("/getNewestTokens", async (_, res) => {
  let tokens_721 = await ERC721TOKEN.find().sort({ createdAt: 1 }).limit(10);
  let tokens_1155 = await ERC1155TOKEN.find().sort({ createdAt: 1 }).limit(10);
  let tokens = new Array();
  tokens.push(...tokens_721);
  tokens.push(...tokens_1155);
  return res.json({
    status: "success",
    data: tokens,
  });
});

router.get("/getNewestAuctions", async (_, res) => {
  let auctions = await Auction.find().sort({ endTime: 1 }).limit(10);
  if (auctions)
    return res.json({
      status: "success",
      data: auctions,
    });
  else
    return res.json({
      status: "success",
      data: [],
    });
});

router.get("/getCollections", async (_, res) => {
  let collections_721 = await ERC721CONTRACT.find();
  let collections_1155 = await ERC1155CONTRACT.find();

  let all = new Array();
  all.push(...collections_721);
  all.push(...collections_1155);
  all = sortBy(all, "name", "desc");
  let allCollections = await Collection.find({});

  let savedAddresses = [];
  let allContracts = new Array();

  for (let i = 0; i < all.length; ++i) {
    let contract = all[i];
    let collection = allCollections.find(
      (col) => col.erc721Address.toLowerCase() == contract.address.toLowerCase()
    );

    if (collection) {
      if (!savedAddresses.includes(collection.erc721Address)) {
        savedAddresses.push(collection.erc721Address);
        allContracts.push({
          address: collection.erc721Address,
          collectionName: collection.collectionName,
          description: collection.description,
          categories: collection.categories,
          logoImageHash: collection.logoImageHash,
          siteUrl: collection.siteUrl,
          discord: collection.discord,
          twitterHandle: collection.twitterHandle,
          mediumHandle: collection.mediumHandle,
          telegram: collection.telegram,
          isVerified: true,
        });
      }
    } else {
      if (!savedAddresses.includes(contract.address)) {
        savedAddresses.push(contract.address);
        allContracts.push({
          address: contract.address,
          name: contract.name != "name" ? contract.name : "",
          symbol: contract.symbol != "symbol" ? contract.symbol : "",
          isVerified: false,
        });
      }
    }
  }
  return res.json({
    status: "success",
    data: allContracts,
  });
});

router.post("/searchNames", async (req, res) => {
  try {
    let name = req.body.name;
    // get account
    let accounts = await Account.find({
      alias: { $regex: name, $options: "i" },
    })
      .select(["address", "imageHash", "alias"])
      .limit(3);
    let collections = await Collection.find({
      collectionName: { $regex: name, $options: "i" },
    })
      .select(["erc721Address", "collectionName", "logoImageHash"])
      .limit(3);
    let tokens_721 = await ERC721TOKEN.find({
      name: { $regex: name, $options: "i" },
    })
      .select(["contractAddress", "tokenID", "tokenURI", "name"])
      .limit(5);
    let tokens_1155 = await ERC1155TOKEN.find({
      name: { $regex: name, $options: "i" },
    })
      .select(["contractAddress", "tokenID", "tokenURI", "name"])
      .limit(5);
    let tokens = [...tokens_721, ...tokens_1155];
    let data = { accounts, collections, tokens };
    return res.json({
      status: "success",
      data: data,
    });
  } catch (error) {
    return res.json([]);
  }
});

router.get("/getTokenType/:address", async (req, res) => {
  try {
    let address = toLowerCase(req.params.address);
    let category = await Category.findOne({ minterAddress: address });
    if (category) {
      return res.json({
        status: "success",
        data: parseInt(category.type),
      });
    } else {
      return res.json({
        status: "success",
        data: 721,
      });
    }
  } catch (error) {
    return res.json({
      status: "success",
      data: 721,
    });
  }
});

router.get("/getOwnership/:address/:tokenID", async (req, res) => {
  try {
    let collection = toLowerCase(req.params.address);
    let tokenID = parseInt(req.params.tokenID);
    let holdings = await ERC1155HOLDING.find({
      contractAddress: collection,
      tokenID: tokenID,
    }).select(["holderAddress", "supplyPerHolder"]);

    let users = [];
    let promise = holdings.map(async (hold) => {
      let account = await Account.findOne({
        address: hold.holderAddress,
      });
      if (account) {
        users.push({
          address: account.address,
          alias: account.alias,
          imageHash: account.imageHash,
          supply: hold.supplyPerHolder,
        });
      } else {
        users.push({
          address: hold.holderAddress,
          supply: hold.supplyPerHolder,
        });
      }
    });
    await Promise.all(promise);

    let _users = orderBy(users, "supply", "desc");
    return res.json({
      status: "success",
      data: _users,
    });
  } catch (error) {
    return res.json([]);
  }
});

router.get("/get1155info/:address/:tokenID", async (req, res) => {
  try {
    let collection = toLowerCase(req.params.address);
    let tokenID = parseInt(req.params.tokenID);
    let holdings = await ERC1155HOLDING.find({
      contractAddress: collection,
      tokenID: tokenID,
    });
    let count = holdings.length;
    let token = await ERC1155TOKEN.findOne({
      contractAddress: collection,
      tokenID: tokenID,
    });
    let totalSupply = token.supply;
    return res.json({
      status: "success",
      data: {
        holders: count,
        totalSupply: totalSupply,
      },
    });
  } catch (error) {
    return res.json([]);
  }
});

module.exports = router;
