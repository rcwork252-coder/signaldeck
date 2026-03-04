const cron = require('node-cron');
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = 'Rcwork252@gmail.com';
const FROM_EMAIL = 'SignalDeck <onboarding@resend.dev>';
const CRON_SCHEDULE = '0 15 * * *';

const PORTFOLIO = [
  { ticker:'XRP',  name:'XRP',                   type:'crypto', cgId:'ripple',           qty:1205.662    },
  { ticker:'BTC',  name:'Bitcoin',                type:'crypto', cgId:'bitcoin',          qty:0.01906368  },
  { ticker:'SOL',  name:'Solana',                 type:'crypto', cgId:'solana',           qty:1.2192117   },
  { ticker:'HBAR', name:'Hedera',                 type:'crypto', cgId:'hedera-hashgraph', qty:445.23      },
  { ticker:'ONDO', name:'Ondo Finance',            type:'crypto', cgId:'ondo-finance',     qty:100         },
  { ticker:'ADA',  name:'Cardano',                type:'crypto', cgId:'cardano',          qty:53.9        },
  { ticker:'SUI',  name:'Sui',                    type:'crypto', cgId:'sui',              qty:15          },
  { ticker:'PLTR', name:'Palantir',               type:'stock',  qty:1       },
  { ticker:'ABTC', name:'Amplify Bitcoin ETF',    type:'stock',  qty:50      },
  { ticker:'XXI',  name:'Twenty One Capital',     type:'stock',  qty:10      },
  { ticker:'XLE',  name:'Energy Select SPDR ETF', type:'stock',  qty:1.02    },
  { ticker:'SCHD', name:'Schwab Dividend ETF',    type:'stock',  qty:2.40    },
  { ticker:'IAU',  name:'iShares Gold ETF',       type:'stock',  qty:0.859073},
  { ticker:'CVX',  name:'Chevron',                type:'stock',  qty:1       },
  { ticker:'SLV',  name:'iShares Silver ETF',     type:'stock',  qty:1       },
  { ticker:'USO',  name:'US Oil Fund',            type:'stock',  qty:1       },
];

async function fetchCryptoPrices() {
  const crypto = PORTFOLIO.filter(a => a.type === 'crypto');
  const ids = crypto.map(a => a.cgId).join(',');
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
  const data = await res.json();
  const prices = {};​​​​​​​​​​​​​​​​
