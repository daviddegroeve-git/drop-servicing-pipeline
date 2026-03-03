async function test() {
    try {
        const res = await fetch('https://image.pollinations.ai/prompt/car%20wash?width=600&height=400&nologo=true');
        console.log("Status:", res.status);
        console.log("URL:", res.url);
        console.log("Type:", res.headers.get('content-type'));
    } catch (e) {
        console.error(e);
    }
}
test();
