import bcrypt from 'bcrypt';

export class CryptoService {

    //the more its high the slower it will be, but it will also be safer
    constructor(private readonly saltRounds: number = 10){}

    async hashPassword(password:string):Promise<string>{
        
        return await bcrypt.hash(password, this.saltRounds);
    }

    async comparePassword(password:string, hashed: string):Promise<boolean>{
        //"hashed"is the value returned from bcrypt.hash() and it's a string
        return await bcrypt.compare(password, hashed);
    }

}
