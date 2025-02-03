import * as fs from "node:fs";
import path from "node:path";

describe('MyTest2', () => {
    before(function () {
        console.log("MyTest2");
    })

    it('Lets upload something', async () => {

        fs.readdirSync('/tmp/iz-seeder-bot/seeding').forEach(    filename => {
            console.log(filename)
        })

    })
})
