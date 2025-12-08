import { getDomainGuardStructs } from "./src/main";
import * as path from "path";

async function test() {
  const examplesDir = path.join(__dirname, "examples");
  console.log(`Parsing .dg files from: ${examplesDir}\n`);

  try {
    const configs = await getDomainGuardStructs(examplesDir);
    console.log("Parsed Domain Guard Configs:");
    console.log(JSON.stringify(configs, null, 2));
  } catch (err) {
    console.error("Error parsing configs:", err);
    process.exit(1);
  }
}

test();
