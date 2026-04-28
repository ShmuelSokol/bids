import "./env";
console.log("LL_SALLY_LOGIN:", !!process.env.LL_SALLY_LOGIN, process.env.LL_SALLY_LOGIN?.slice(0,5) + "...");
console.log("LL_API_KEY:    ", !!process.env.LL_API_KEY, process.env.LL_API_KEY?.slice(0,5) + "...");
console.log("LL_API_SECRET: ", !!process.env.LL_API_SECRET);
console.log("LL_E_CODE:     ", process.env.LL_E_CODE);
