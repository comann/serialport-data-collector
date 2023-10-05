
export namespace Util {
  export async function askForUserInput(prompt: string) {
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question(`${prompt}\n`, (input: string) => {
        readline.close();

        resolve(input)
      });
    })
  }

  export function promiseTimeout(seconds: number, message: string) {
    return new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error(message)), seconds * 1000)
    })
  }

  export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}