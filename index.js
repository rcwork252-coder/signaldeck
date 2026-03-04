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
  const prices = {};
  crypto.forEach(a => {
    if (data[a.cgId]) {
      prices[a.ticker] = { price: data[a.cgId].usd, change24h: data[a.cgId].usd_24h_change ?? 0 };
    }
  });
  return prices;
}

async function fetchStockPrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2d`;
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    const outer = await res.json();
    const data = JSON.parse(outer.contents);
    const quotes = data.chart.result[0];
    const closes = quotes.indicators.quote[0].close;
    const price = closes[closes.length - 1];
    const prev = closes[closes.length - 2] || price;
    return { price, change24h: ((price - prev) / prev) * 100 };
  } catch { return { price: null, change24h: 0 }; }
}

async function fetchStockPrices() {
  const stocks = PORTFOLIO.filter(a => a.type === 'stock');
  const results = await Promise.all(stocks.map(a => fetchStockPrice(a.ticker)));
  const prices = {};
  stocks.forEach((a, i) => { prices[a.ticker] = results[i]; });
  return prices;
}

async function getAIAnalysis(portfolioWithPrices) {
  const lines = portfolioWithPrices.map(a =>
    `${a.ticker} (${a.name}): price=$${a.price}, 24h=${a.change24h?.toFixed(2)}%, value=$${a.value?.toFixed(2)}`
  ).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: `You are a portfolio analyst. Analyze this long-term investor portfolio using live prices.\n\n${lines}\n\nFor each asset give: Signal (BUY/HOLD/SELL), Take Profit, Stop Loss, and one sentence reason. Then give a 3-sentence portfolio summary, top 2 action items, and one risk to watch. Be direct and concise.` }]
    })
  });
  const data = await res.json();
  return data.content[0].text;
}

function buildEmail(portfolio, analysis, totalValue, totalChange) {
  const date = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const rows = portfolio.map(a => `
    <tr style="border-bottom:1px solid #252830">
      <td style="padding:10px;font-family:monospace;color:#00b4d8;font-weight:700">${a.ticker}</td>
      <td style="padding:10px;color:#e8eaf0">${a.name}</td>
      <td style="padding:10px;font-family:monospace;color:#e8eaf0">$${Number(a.price||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
      <td style="padding:10px;font-family:monospace;color:${(a.change24h||0)>=0?'#00e676':'#ff1744'}">${(a.change24h||0)>=0?'+':''}${(a.change24h||0).toFixed(2)}%</td>
      <td style="padding:10px;font-family:monospace;color:#e8eaf0">$${(a.value||0).toFixed(2)}</td>
    </tr>`).join('');

  const analysisHtml = analysis.split('\n').map(l => l.trim() ? `<p style="margin:0 0 8px;color:#c8cad0;line-height:1.6">${l}</p>` : '<br>').join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0c10;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px">
    <div style="border-bottom:1px solid #252830;padding-bottom:20px;margin-bottom:24px">
      <div style="font-size:22px;font-weight:800;color:#e8eaf0">SIGNAL<span style="color:#00b4d8">DECK</span> <span style="font-size:11px;color:#5a5f6e">DAILY BRIEFING</span></div>
      <div style="font-size:12px;color:#5a5f6e;margin-top:4px;font-family:monospace">${date} · 10:00 AM EST</div>
    </div>
    <div style="background:#111318;border:1px solid #252830;border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="font-size:11px;color:#5a5f6e;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Total Portfolio Value</div>
      <div style="font-size:36px;font-weight:800;color:#e8eaf0;font-family:monospace">$${totalValue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div style="font-size:13px;color:${totalChange>=0?'#00e676':'#ff1744'};font-family:monospace;margin-top:4px">${totalChange>=0?'+':''}${totalChange.toFixed(2)}% today</div>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#111318;border:1px solid #252830;border-radius:12px;margin-bottom:24px">
      <thead><tr style="background:#1a1d24">
        <th style="padding:10px;text-align:left;font-size:11px;color:#5a5f6e">TICKER</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#5a5f6e">ASSET</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#5a5f6e">PRICE</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#5a5f6e">24H</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#5a5f6e">VALUE</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="background:#111318;border-left:3px solid #00b4d8;border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="font-size:11px;color:#5a5f6e;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px">AI Analysis</div>
      ${analysisHtml}
    </div>
    <div style="font-size:11px;color:#5a5f6e;text-align:center;padding-top:16px;border-top:1px solid #252830">Not financial advice · For informational purposes only</div>
  </div></body></html>`;
}

async function runDailyBriefing() {
  console.log(`[${new Date().toISOString()}] Running daily briefing...`);
  try {
    const cryptoPrices = await fetchCryptoPrices();
    const stockPrices = await fetchStockPrices();
    const allPrices = { ...cryptoPrices, ...stockPrices };

    const portfolio = PORTFOLIO.map(a => {
      const p = allPrices[a.ticker] || {};
      const price = p.price || 0;
      return { ...a, price, change24h: p.change24h || 0, value: price * a.qty };
    });

    const totalValue = portfolio.reduce((s, a) => s + a.value, 0);
    const totalChange = portfolio.reduce((s, a) => s + (a.value * (a.change24h / 100)), 0) / totalValue * 100;

    const analysis = await getAIAnalysis(portfolio);
    const resend = new Resend(RESEND_API_KEY);
    const html = buildEmail(portfolio, analysis, totalValue, totalChange);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: `📊 SignalDeck · ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})} | $${totalValue.toFixed(0)} | ${totalChange>=0?'▲':'▼'}${Math.abs(totalChange).toFixed(2)}%`,
      html
    });

    if (error) throw new Error(JSON.stringify(error));
    console.log(`✅ Email sent! ID: ${data.id}`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

cron.schedule(CRON_SCHEDULE, runDailyBriefing, { timezone: 'America/New_York' });
console.log('🚀 SignalDeck running — emails at 10:00 AM EST daily');

if (process.env.RUN_NOW === 'true') runDailyBriefing();
