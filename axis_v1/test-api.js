(async () => {
// const key = //your key;
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'AXIS'
  },
  body: JSON.stringify({
    model: 'deepseek/deepseek-r1-0528',
    messages: [{role: 'user', content: 'hello'}],
    max_tokens: 100
  })
});
console.log('Status:', response.status);
const data = await response.json();
console.log(JSON.stringify(data, null, 2).substring(0, 800));
})();
