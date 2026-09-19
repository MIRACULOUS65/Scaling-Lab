import http from "http";

const servers = [
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
];

let currentServer=0;

const loadBalancer = http.createServer(async(req,res)=>{
    const target = servers[currentServer];

    currentServer = (currentServer +1) % servers.length;

    try{
        const response = await fetch(target + req.url);

        const body = await response.text();

    res.writeHead(response.status, {
      "Content-Type":
        response.headers.get("content-type") ||
        "application/json"
    });

    res.end(body);

    console.log(`Forwarded ${req.url} → ${target}`);
  } catch (error) {
    res.statusCode = 503;
    res.end("Service unavailable");
  }
});

loadBalancer.listen(8080, () => {
  console.log("Load balancer running on http://localhost:8080");
});