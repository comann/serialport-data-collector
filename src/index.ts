import { SerialPort } from 'serialport';
import _SerialPort, { PortInfo } from './SerialPort'
import { Util } from './Util'
import papa from 'papaparse'
import fs from 'fs'
import os from 'os'

const TargetPID = 'EA60'
const TargetVID = '10C4'


process.removeAllListeners('warning')

async function main() {

  const deviceName = await Util.askForUserInput("Type the name of the devices being connected.\n\tspectro-one\n\tspectro-one-pro")
  const metric = await Util.askForUserInput("Are these fails or passes?")
  const filenames = {
    bp: `${os.homedir()}/Documents/${deviceName}.${metric}.blackpoint.${new Date().getTime()}.csv`,
    wp: `${os.homedir()}/Documents/${deviceName}.${metric}.whitepoint.${new Date().getTime()}.csv`
  }


  while (true) {
    try {
      console.log('------------------------------------------------------------------------')
      const input = await Util.askForUserInput('Plug in UART Board, Instrument.\n> Once ready press any key or q to exit')
      if (input === 'q') {
        break;
      }


      const deviceInfo = await collectManufacturerScans();


      (deviceInfo.bp as any).serial = deviceInfo.serial;
      (deviceInfo.bp as any).firmware = deviceInfo.firmware;
      (deviceInfo.wp as any).firmware = deviceInfo.firmware;
      (deviceInfo.wp as any).serial = deviceInfo.serial;

      fs.appendFileSync(filenames.wp, papa.unparse([deviceInfo.wp]))
      fs.appendFileSync(filenames.bp, papa.unparse([deviceInfo.bp]))
      console.log('> Appended Results to File')

    } catch (err) {
      console.log(err);
    }
  }
}




async function collectManufacturerScans() {
  let info: PortInfo | undefined = undefined;

  do {
    const list = (await SerialPort.list()).filter(x => {
      if (x.productId && x.vendorId) {
        return x.productId.toUpperCase() === TargetPID && x.vendorId.toUpperCase() == TargetVID
      }
      return false
    })

    if (list.length === 0) {
      console.log('No UART Adapter Board Found')
      await Util.delay(3000)
      continue
    }


    if (list.length > 2) {
      console.log('Found too many UART Adapter Boards. (Limit 1)')
      await Util.delay(3000)
      continue;
    }
    info = list[0]

  } while (!info)

  const serial = new _SerialPort(info)
  await serial.open()

  let deviceInfo = { serial: '', firmware: '', bp: {} as { [k: string]: number }, wp: {} as { [k: string]: number }, }
  let didComplete = false
  do {
    try {
      await serial.start()
      deviceInfo.serial = await serial.requestSerial()
      console.log('> Instrument ', deviceInfo.serial)
      deviceInfo.firmware = await serial.requestFirmware()
      console.log('> Instrument Firmware', deviceInfo.firmware)
      deviceInfo.bp = await serial.requestBP()
      console.log('> Got Blackpoint')
      deviceInfo.wp = await serial.requestWP()
      console.log('> Got Whitepoint')

      didComplete = true
    } catch (err) {
      console.log('> Unable to detect instrument')
      console.log('\t', (err as Error).message)

    } finally {
      await Util.delay(1000)
    }
  } while (didComplete == false)

  serial.close()

  return deviceInfo
}


main().then(() => process.exit())
