/**
 * New-line delimited JSON serialiation utilities
 */

import { createReadStream, createWriteStream, existsSync } from "fs";

export declare type NDJsonInfo = {
  payload: any[];
  version: number;
};
/**
 * Parse the NDJSon from a file
 * @param path path to the file in question
 * @returns parsed data
 */
export function parseNDJson(path: string): Promise<NDJsonInfo> {
  if (!existsSync(path)) {
    throw new Error(`File ${path} not exists`);
  }
  let stream = createReadStream(path, { encoding: "utf-8" });
  let return_val: any[] = [];
  let buff = "";
  let parsed_json = false;
  let failed = false;
  let version = 1;
  let callback_resolve: Function, callback_reject: Function;
  let return_promise: Promise<NDJsonInfo> = new Promise((resolve, reject) => {
    callback_resolve = resolve;
    callback_reject = reject;
  });
  function tryParse(): void {
    try {
      while (!failed && buff.indexOf("\n") != -1) {
        //get the part
        let idx = buff.indexOf("\n");
        let buff_to_parse = buff.substring(0, idx).trim();
        //remove it from the buffer
        buff = buff.slice(idx + 1);
        if (!parsed_json) {
          parsed_json = true;
          //check the presence of version number inside the response
          if (/^[\d]+$/.test(buff_to_parse)) {
            let parsed_version = parseInt(buff_to_parse);
            version = parsed_version;
            continue;
          }
        }
        if (buff_to_parse.length > 0) {
          //parse that and push it into return_val
          return_val.push(JSON.parse(buff_to_parse));
        }
      }
    } catch (err) {
      //it is failed
      stream.close();
      failed = true;
      callback_reject(err);
    }
  }
  stream.on("data", (chunk: string) => {
    //add the string into buffer
    buff += chunk;
    tryParse();
  });
  stream.on("error", (err) => {
    callback_reject(err);
  });
  stream.on("close", () => {
    //perform final clean up
    buff += "\n";
    tryParse();
    if (buff.length > 0) {
      console.log(`Log=${buff}`);
      callback_reject(new Error("Incomplete parsing! Bug?"));
      return;
    }
    if (!failed) {
      callback_resolve({
        payload: return_val,
        version,
      });
    }
  });
  return return_promise;
}

/**
 * Flush the data into file as NSJson
 * @param path path to the file to write
 * @param data data to write
 */
export function writeNDJson(
  path: string,
  data: any[],
  version: number = 1
): Promise<void> {
  return new Promise((resolve, reject) => {
    let stream = createWriteStream(path);
    stream.on("error", reject);
    stream.on("finish", resolve);
    //write the version number
    stream.write(`${version}\n`);
    data.forEach((e) => stream.write(`${JSON.stringify(e)}\n`));
    stream.end();
  });
}
