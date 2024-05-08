const axios = require("axios");
require("dotenv").config();
const Decimal = require('decimal.js');

const OKLINK_API_KEY = process.env.API_KEY;
const TOKEN_CONTRACT = "YOUR_TOKEN_CONTRACT" //Token Contract Address that you want analyze
const minimumAmount=1000000 //Minimum amount for filtering large transaction


const requestsPerSecond = 5; // API Rate Limit
const delayBetweenRequests = 1000 / requestsPerSecond;

//Function for Rate Limit
async function req(url, axiosConfig) {  
  await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
  return axios(url, axiosConfig);
}

//Function to fetch Token Information
const getTokenInfo = async () => {
  const url =
    "https://www.oklink.com/api/v5/explorer/eth/api?module=token&action=tokeninfo";
  const response = await req(url, {
    params: {
      contractaddress: TOKEN_CONTRACT,
    },
    headers: {
      "Ok-Access-Key": OKLINK_API_KEY,
    },
  });
  return response.data;
};

//Function to print Token Information
const showTokenInfo = async () => {
  try {
    const tokenInfo = await getTokenInfo(TOKEN_CONTRACT);
	const formattedOutput = `
Token Information
---------------------------------------------------------------------------------------
Token Contract Address | ${tokenInfo.result.contractAddress}	                       
Token Name             | ${tokenInfo.result.tokenName}                                
Symbol                 | ${tokenInfo.result.symbol}                                   
Decimals               | ${tokenInfo.result.divisor}                                  
Token Type             | ${tokenInfo.result.tokenType}                                
Total Supply           | ${tokenInfo.result.totalSupply}                              
Website                | ${tokenInfo.result.website}                                  
Twitter:               | ${tokenInfo.result.twitter}                                  
Whitepaper             | ${tokenInfo.result.whitepaper}                               
Current Price (USD)    | $${tokenInfo.result.tokenPriceUSD}                           
----------------------------------------------------------------------------------------
	  `;
  console.log(formattedOutput);
  } catch (error) {
    console.error("Error fetching token info:", error); 
  }
};

////Function to fetch Token Price Data
const getTokenPriceData = async () => {
  const url =
    "https://www.oklink.com/api/v5/explorer/tokenprice/historical?chainId=1";
  const response = await req(url, {
    params: {
      tokenContractAddress: TOKEN_CONTRACT,
	  limit: 200,
    },
    headers: {
      "Ok-Access-Key": OKLINK_API_KEY,
    },
  });
  return response.data;
};

//Function to print Token Price Data
const showTokenPriceData = async () => {
  try {
    const tokenPriceData = await getTokenPriceData(TOKEN_CONTRACT);
    const formattedOutput = `
Token Price Data
------------------------
Date       | Price (USD) 
------------------------
${tokenPriceData.data.map((dataPoint) => {
      const date = new Date(dataPoint.time * 1).toLocaleDateString();
      const price = parseFloat(dataPoint.price).toFixed(4); 
      return `${date} | ${price}\n`; 
    }).join('')}
------------------------
    `;

    console.log(formattedOutput);
  } catch (error) {
    console.error("Error fetching or formatting token price data:", error);
  }
};

//Function to fetch Token Holder data
const getHoldingData = async () => {
  let page = 1;
  let result = [];
  const maxResultsPerPage = 100;
  while (true) {
    try {
      const response = await req("https://www.oklink.com/api/v5/explorer/eth/api?module=token&action=tokenholderlist", {
        params: {
          contractaddress: TOKEN_CONTRACT,
          page: page.toString(),
          offset: maxResultsPerPage.toString()
        },
	    headers: {
		  "Ok-Access-Key": OKLINK_API_KEY,
		},
      });

      if (response.data.status === "1" && response.data.result.length > 0) {
        result = result.concat(response.data.result);
        // If the length of the result array is less than maxResultsPerPage, break the loop
        if (response.data.result.length < maxResultsPerPage) {
          break;
        }
        page++; // Increment page number for the next request
      } else {
        // Handle API error or no more data
        console.error("Error fetching token holder list:", response.data.message);
        break;
      }
    } catch (error) {
      console.error("Error fetching token holder list:", error);
      break;
    }
  }
  return result;
}

//Function to print Token Holder Data
const showHoldingData = async () => {
  const getDecimal = await getTokenInfo();
  token_decimal = getDecimal.result.divisor;
  try {
    const tokenHoldingData = await getHoldingData(TOKEN_CONTRACT);
	let totalQuantity = new Decimal(0);
	  for (const item of tokenHoldingData) {
		const quantity = new Decimal(item['TokenHolderQuantity']);
		totalQuantity = totalQuantity.plus(quantity);
	  }
  const formattedOutput = `
Token Holding
-----------------------------------------------------------------------------------------------
Rank| Holder Address                             | Quantity           | Proportion
-----------------------------------------------------------------------------------------------
${tokenHoldingData.map((item, index) => {
    const quantity = new Decimal(item['TokenHolderQuantity']);
    const proportion = quantity.dividedBy(totalQuantity).times(100).toFixed(18);
    const formattedQuantity = quantity.dividedBy(new Decimal(10).pow(token_decimal));

    return `${index + 1}   | ${item['TokenHolderAddress'].padEnd(40)} | ${formattedQuantity.toString().padStart(18)} | ${proportion}% \n`; 
  }).join('')}
-----------------------------------------------------------------------------------------------
  `;

  console.log(formattedOutput);
  console.log();
  } catch (error) {
    console.error("Error fetching or formatting token holding data:", error);
  }
};

//Function to fetch and print Token Liquidity Data
const showLiquidityData = async () => {
  let page = 1;
  let result = [];
  const maxResultsPerPage = 100;
  while (true) {
    try {
      const response = await req("https://www.oklink.com/api/v5/explorer/token/transaction-stats", {
        params: {
          chainShortName: "eth",
          tokenContractAddress : TOKEN_CONTRACT,
          page: page.toString(),
          limit: maxResultsPerPage.toString()
        },
	    headers: {
		  "Ok-Access-Key": OKLINK_API_KEY,
		},
      });

      if (response.data.code === '0') {
        const transactionAddressList = response.data.data[0].transactionAddressList;
        result = result.concat(transactionAddressList);

        // Check if we've reached the last page
        if (response.data.data[0].page === response.data.data[0].totalPage) {
          break;
        }

        page++; // Increment page number for the next request
      } else {
        console.error("Error fetching transactions:", response.data.msg);
        break; 
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      break;
    }
  }
  // Initialize variables
  let totalTransactions = 0;
  let totalTradingVolume = 0;

  // Loop through transactions and accumulate data
  for (const transaction of result) {
      totalTransactions += parseInt(transaction.txnCount, 10);
      totalTradingVolume += parseFloat(transaction.txnValueUsd);
  }
  console.log("Token Liquidity");
  console.log("----------------------------------------------------------------------------------------------");
  console.log("Number of Transactions (24h):", totalTransactions);
  console.log(`Trading Volume (24h): ${totalTradingVolume} USD`);
  console.log();
};

//Function to fetch Token Transaction
const getLargeTX = async () => {
  let page = 1;
  let result = [];
  const maxResultsPerPage = 100;
  while (true) {
    try {
      const response = await req("https://www.oklink.com/api/v5/explorer/token/transaction-list", {
        params: {
          chainShortName: "eth",
          tokenContractAddress : TOKEN_CONTRACT,
          page: page.toString(),
          minAmount: minimumAmount.toString(),
          limit: maxResultsPerPage.toString()
        },
	    headers: {
		  "Ok-Access-Key": OKLINK_API_KEY,
		},
      });

      if (response.data.code === '0') {
        const transactionList = response.data.data[0].transactionList;
        result = result.concat(transactionList);

        // Check if we've reached the last page
        if (response.data.data[0].page === response.data.data[0].totalPage) {
          break;
        }

        page++; // Increment page number for the next request
      } else {
        console.error("Error fetching transactions:", response.data.msg);
        break; 
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      break;
    }
  }
  return result;
};

//Function to print Token Large Transaction
const showLargeTX = async () => {
  try {
    const largeTransactions = await getLargeTX(TOKEN_CONTRACT);

    const formattedOutput = `
Token Large Transactions
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
TxID                                                               | Transaction Time     | From                                       | To                                         | Amount
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
${largeTransactions.map(tx => {
  return `${tx.txid.padEnd(40)} | ${new Date(parseInt(tx.transactionTime)).toLocaleString()} | ${tx.from} | ${tx.to} | ${tx.amount} ${tx.transactionSymbol || ''}\n`; 
}).join('')}
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
    `;

    console.log(formattedOutput);
  } catch (error) {
    console.error("Error fetching or formatting large transaction data:", error);
  }
};


async function run() {
    await showTokenInfo();
    await showTokenPriceData();  
    await showHoldingData(); 
    await showLiquidityData(); 
    await showLargeTX();
}

run(); 
