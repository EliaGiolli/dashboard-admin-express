import { type SystemTypes } from "../types/systemTypes.js";
import os from 'node:os'

const serverStartTime = Date.now();

export function getSystemStats():SystemTypes{
    return {
        uptime: os.uptime(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        serverUpTime: Date.now() - serverStartTime,
        createdAt: new Date(),
        cpuUsagePercent: calculateCpuUsage()
    }
}

function calculateCpuUsage():number{
    
    const used = Math.random() * 100;
    return Math.round(used * 100);
}