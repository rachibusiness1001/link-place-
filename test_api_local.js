const data = {
  domain: "jeecart.com",
  anchor: "403 web scraping",
  altAnchor: "",
  linkto: "https://www.zenrows.com/blog/403-web-scraping",
  isBranded: false,
  anchors: [
    "403 web scraping ",
    "403 forbidden web scraping",
    "web scraping 403 error",
    "403 error web scraping",
    "handling 403 web scraping"
  ]
};

fetch("http://localhost:3000/api/analyze", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(data)
})
.then(async res => {
  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("BODY:", text);
})
.catch(console.error);
