import os from 'os';

export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        // Prioritize standard LAN subnets: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
        if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.')) {
          candidates.unshift(net.address);
        } else {
          candidates.push(net.address);
        }
      }
    }
  }

  return candidates.length > 0 ? candidates[0] : '127.0.0.1';
}

export function printLanAccessInfo(apiPort = 5000, clientPort = 5173) {
  const ip = getLocalIpAddress();
  console.log(`\n==============================================`);
  console.log(`  Local PC LAN IP Address: ${ip}`);
  console.log(`  Backend API:  http://${ip}:${apiPort}`);
  console.log(`  Frontend Web: http://${ip}:${clientPort}`);
  console.log(`==============================================\n`);
}

// When executed directly:
if (process.argv[1] && process.argv[1].endsWith('networkIp.js')) {
  printLanAccessInfo();
}
