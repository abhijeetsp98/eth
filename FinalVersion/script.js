var bodyParser = require("body-parser");
var express = require("express");
var app=express();
app.set("view engine","ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({text:true}));

const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
var fs = require('fs');
const SHA256 = require('crypto-js/sha256');
const { log } = require("console");

class Transaction{
    constructor(dict)
    {
        this.location = dict.location;
        this.ownership = dict.ownership;
        this.signature = "#"
    }

    calculateHash(){
        return SHA256(this.location + this.ownership).toString();
    }

    signTransaction(signingKey){
        const privateKey = signingKey;
        const myKey = ec.keyFromPrivate(privateKey);
        const myWalletAddress = myKey.getPublic('hex');
        const hashTx = this.calculateHash();
        const sig = myKey.sign(hashTx, 'base64');
        this.signature = sig.toDER('hex');
    }

    isValid(){
        if(!this.signature || this.signature.length === 0)
        {
            throw new Error('No signature in this transaction');
        }

        const privateKey = this.ownership.fromAddress;
        const myKey = ec.keyFromPrivate(privateKey);
        const myWalletAddress = myKey.getPublic('hex');
        if(myKey.verify(this.calculateHash(),this.signature))
        {
            this.ownership.fromAddress = myWalletAddress;
            return true;
        }else
        {
            return false;
        }
        /*
        const publicKey = ec.keyFromPublic(this.ownership.fromAddress, 'hex');
        return publicKey.verify(this.calculateHash(),this.signature);
        */
    }
}

class Block{
    constructor( transaction, previousHash = '#')
    {
        var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        var today  = new Date();
        this.timestamp = today.toLocaleDateString("en-US", options);;
        this.transaction = transaction;
        this.previousHash = previousHash;
        this.nonce = 0; 
        this.hash = this.calculateHash();
    }
    calculateHash(){
        return SHA256( this.previousHash + this.timestamp + JSON.stringify(this.transaction) + this.nonce).toString();
    }
    mineBlock(difficulty)
    {
        while(this.hash.substring(0,difficulty) !== Array(difficulty + 1).join("0"))
        {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log("Block mined: " + this.hash);
    }
}

class DLTBlock{
    constructor(timestamp,transaction, previousHash, hash, nonce){
        var timestamp = timestamp;
        this.timestamp = timestamp;
        this.transaction = transaction;
        this.previousHash = previousHash;
        this.hash = hash;
        this.nonce = nonce;
    }
    calculateHash(){
        return SHA256(this.previousHash + this.timestamp + JSON.stringify(this.transaction) + this.nonce).toString();
    }
    mineBlock(difficulty)
    {
        while(this.hash.substring(0,difficulty) !== Array(difficulty + 1).join("0"))
        {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log("Block mined: " + this.hash);
    }
}

class DLTBlockChain{
    constructor(newBlock){
        this.chain = [newBlock];
        this.difficulty = 4;
        this.pendingTransactions = {};
        this.miningReward = 10;
    }
    getLatestBlock(){
        return this.chain[this.chain.length-1];
    }
    addDLTBlock(newBlock){
        this.chain.push(newBlock);
    }
    addBlock(newBlock){
        newBlock.previousHash = this.getLatestBlock().hash;
        newBlock.mineBlock(this.difficulty);
        this.chain.push(newBlock);
    }
    isChainValid(){
        const currentBlock = this.chain[0];
        if(currentBlock.hash!=currentBlock.calculateHash())
        {return false;}
        for(var i=1; i<this.chain.length; i++)
        {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i-1];    
            if(currentBlock.hash !== currentBlock.calculateHash()){
                return false;
            }
            if(currentBlock.previousHash !== previousBlock.hash){
                return false;
            }
        }
        return true;
    }

    minePendingTransactions(){
        let block = new Block(this.pendingTransactions, this.getLatestBlock().hash);
        block.mineBlock(this.difficulty);

        console.log('Block successfully mined!');
        this.chain.push(block);
        this.pendingTransactions = {};
    }

    createTransaction(transaction){

        transaction.signTransaction(transaction.ownership.fromAddress)
        if(!transaction.ownership.fromAddress || !transaction.ownership.toAddress)
        {
            throw new Error('Transaction must include from and to address');
        }
        
        if(!transaction.isValid())
        {
            throw new Error('Cannot add invalid transaction to the chain')
        }
        this.pendingTransactions= transaction;
    }
}

//Creation of genises block
/*
var data = {
    "location": {
      "district": "#",
      "taluka": "#",
      "village": "#",
      "khatraNo": "#",
      "layoutNo": "#",
      "nagar": "#"
    },
    "ownership": {
      "date":"#",
      "seller": "#",
      "buyer": "#",
      "fromAddress": "#",
      "toAddress": "#"
    }
  }
let firstBlock = new Block(data);
let example = new DLTBlockChain(firstBlock);

var data = JSON.stringify(example,null,2);
fs.writeFile('chain.json',data,fin);
function fin(){}

console.log(example.isChainValid());

*/

var data = fs.readFileSync('chain.json');
var words = JSON.parse(data);


let firstBlock = new DLTBlock(words.chain[0].timestamp, words.chain[0].transaction, words.chain[0].previousHash, words.chain[0].hash, words.chain[0].nonce);
let example = new DLTBlockChain(firstBlock);

for(var i=1;i<words.chain.length;i++)
{
    let tempDLTBlock = new DLTBlock(words.chain[i].timestamp, words.chain[i].transaction, words.chain[i].previousHash, words.chain[i].hash, words.chain[i].nonce);
    example.addDLTBlock(tempDLTBlock);
}


//home page
app.get("/",function(req,res){
    var data = fs.readFileSync('chain.json');
    var words = JSON.parse(data);
    if(example.isChainValid())
    {
        res.render("index",{words: words.chain});
    }else{
        console.log("Chain is tampered");
        res.render("error");
    }
});

//get individual block info
app.get("/block/:id",function(req,res){
    var data = fs.readFileSync('chain.json');
    var words = JSON.parse(data);
    res.render("block",{word: words.chain[req.params.id]});
});

//seach routes
app.get("/search",function(req,res){
    res.render("search");
});
app.post("/result",function(req,res){
    var query = req.body.location;
    var data = fs.readFileSync('chain.json');
    var words = JSON.parse(data);
    var data = [];
    for(var i=0;i<words.chain.length;i++)
    {
        if((query.district==words.chain[i].transaction.location.district)&&(query.taluka==words.chain[i].transaction.location.taluka))
        { 
            if((query.village==words.chain[i].transaction.location.village)&&(query.khatraNo==words.chain[i].transaction.location.khatraNo))
         {
            if((query.layoutNo==words.chain[i].transaction.location.layoutNo)&&(query.nagar==words.chain[i].transaction.location.nagar))
          {
            {
                data.push(words.chain[i].transaction.ownership);
            }
          }
         }
        }
    }
    res.render("result",{results:data,loc:query});
});

//adding new transaction
app.get("/new",function(req,res){
    res.render("new");
});

app.post("/block",function(req,res){
    var query = {
        "location": req.body.location,
        "ownership": req.body.ownership,
    }

    var data = fs.readFileSync('chain.json');
    var words = JSON.parse(data);
    var dict=[];
    for(var i=0;i<words.chain.length;i++)
    {
        if((query.location.district==words.chain[i].transaction.location.district)&&(query.location.taluka==words.chain[i].transaction.location.taluka))
        { 
            if((query.location.village==words.chain[i].transaction.location.village)&&(query.location.khatraNo==words.chain[i].transaction.location.khatraNo))
            {
                if((query.location.layoutNo==words.chain[i].transaction.location.layoutNo)&&(query.location.nagar==words.chain[i].transaction.location.nagar))
                {
                    dict.push(words.chain[i].transaction.ownership);
                }    
            }
        }
    }
    console.log(dict.length)
    console.log(query.ownership.fromAddress)
    if(dict.length!=0)
    {
        const privateKey = query.ownership.fromAddress;
        const myKey = ec.keyFromPrivate(privateKey);
        const myWalletAddress = myKey.getPublic('hex');
        console.log(myWalletAddress)
        console.log(dict[dict.length-1].toAddress)
        if((dict[dict.length-1].buyer == query.ownership.seller)&&( dict[dict.length-1].toAddress == myWalletAddress  ))
        {
            var data = {location:query.location ,ownership:query.ownership}
            const tx = new Transaction(data);

            example.createTransaction(tx);
            console.log("\n starting the minner in if else statement...");
            example.minePendingTransactions();

            var data = JSON.stringify(example,null,2);
            fs.writeFile('chain.json',data,fin);
            function fin(){}
            res.redirect("/");
        }else{
            console.log("Invalid operation you are not the owner");
            res.render("notOwner");
        }
    }else{
        var data = {location:query.location ,ownership:query.ownership}
        const tx = new Transaction(data);
        example.createTransaction(tx);

        console.log("\n starting the minner...");
        example.minePendingTransactions();

        var data = JSON.stringify(example,null,2);
        fs.writeFile('chain.json',data,fin);
        function fin(){}
        res.redirect("/");
    }
});

//creating server 
app.listen(3000,function(){
    console.log("server is up");
})


