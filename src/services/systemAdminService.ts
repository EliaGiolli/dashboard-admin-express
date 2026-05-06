import os from 'node:os';
import { prisma } from "../lib/prisma.js";
import { type System as SystemModel } from "../generated/prisma/client.js";

const serverStartTime = Date.now();

// Save the current state inside the DB.
export async function saveCurrentSystemStats(): Promise<SystemModel> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return await prisma.system.create({
        data: {
            uptime: Math.floor(os.uptime()),
            totalMemory: totalMem,
            freeMemory: freeMem,
            serverUpTime: Date.now() - serverStartTime,
            cpuUsagePercent: Math.round(Math.random() * 100), 
            createdAt: new Date()
        }
    });
}

// It reads the history from the DB.
export async function getSystemHistory(): Promise<SystemModel[]> {
    return await prisma.system.findMany({
        take: 20,
        orderBy: {
            createdAt: 'desc'
        }
    });
}