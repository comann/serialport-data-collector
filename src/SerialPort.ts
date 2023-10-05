import { SerialPort } from 'serialport';
import { Util } from './Util';
export type PortInfo = Awaited<ReturnType<typeof SerialPort['list']>>[number]

const promiseTimeout = () => Util.promiseTimeout(3, "Read timeout has elapsed")


function toLines(data: Buffer) {
  console.log('indexOf: ', data.toString().indexOf("\r\n"), data.toString())
  return data.toString().split("\r\n")
    .filter(x => x.length > 1)
}

export default class SerialConnection {
  private readonly port: SerialPort
  private readonly listeners: ((lines: string[]) => boolean)[] = []


  constructor(info: PortInfo) {
    this.port = new SerialPort({
      path: info.path,
      baudRate: 115200,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
      autoOpen: false
    });
  }

  public close() {
    this.port.close()
  }
  public open() {
    const action = new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          reject(err);
        } else {
          // this.port.on('data', this.onData);
          this.port.on('close', this.onPortClose);

          this.port.set({ dtr: true, dsr: false, cts: false, rts: true })

          resolve(true)
        }
      })
    })

    return Promise.race([action, promiseTimeout()])
  }

  private onPortClose() {
    // console.log('Serial Port Closed')
  }

  private write(command: string, delaySecForResponse: number): Promise<string[]> {
    const action = new Promise<string[]>((resolve, reject) => {

      let current = ""
      const onData = (buf: Buffer) => current += buf.toString()

      // Pretty Crappy.... but it will get the job done
      setTimeout(() => {
        this.port.removeListener('data', onData)
        const lines = current.split("\r\n").filter(x => x.length > 0).filter(x => x !== command)
        resolve(lines)
      }, delaySecForResponse * 1000)

      this.port.on('data', onData);

      this.port.write(`${command}\r\n`, (err) => {
        if (err) {
          reject(err)
        }
      });
    })

    return Promise.race([action, promiseTimeout()]) as Promise<string[]>
  }

  public async start(): Promise<void> {
    await this.write("START", 0.5)
  }

  public async requestSerial(): Promise<string> {
    const responses = await this.write("SER", 0.5)
    if (responses.length === 0) {
      return this.requestSerial()
    }

    const [data] = responses;
    return data.substring(data.indexOf(":") + 2, data.indexOf(":") + 14).trim()
  }

  public async requestFirmware(): Promise<string> {
    const responses = await this.write("VER", 0.5)
    if (responses.length === 0) {
      return this.requestFirmware()
    }


    const [data] = responses;
    return data.substring(data.indexOf(":") + 2).split('-')[1]
  }

  public async requestBP(): Promise<{ [k: string]: number }> {
    const responses = await this.write("CHECKBLACKPOINT", 1)
    if (responses.length === 0) {
      return this.requestBP()
    }


    return responses
      .map((x, index) => x.split(',').map(y => {
        const parts = y.split(':')
        return { value: parseInt(parts[1].trim()), key: `${index}.${parts[0].trim()}` }
      }))
      .flat()
      .reduce((prev, curr) => {
        prev[curr.key] = curr.value;
        return prev
      }, {} as { [k: string]: number })
  }


  public async requestWP(): Promise<{ [k: string]: number }> {
    const responses = await this.write("CHECKWHITEPOINT", 1)
    if (responses.length === 0) {
      return this.requestWP()
    }


    const data = responses.filter(x => x.indexOf("MAIN") !== -1)
      .map((x, index) => x.split(',').map(y => {
        const parts = y.split(':')
        return { value: parseInt(parts[1].trim()), key: `${index}.MAIN.${parts[0].trim()}` }
      }))
      .flat()
      .reduce((prev, curr) => {
        prev[curr.key] = curr.value;
        return prev
      }, {} as { [k: string]: number })

    return responses.filter(x => x.indexOf("AUX") !== -1)
      .map((x, index) => x.split(',').map(y => {
        const parts = y.split(':')
        return { value: parseInt(parts[1].trim()), key: `${index}.AUX.${parts[0].trim()}` }
      }))
      .flat()
      .reduce((prev, curr) => {
        prev[curr.key] = curr.value;
        return prev
      }, data)
  }
}