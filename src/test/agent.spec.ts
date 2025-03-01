import {Test, TestingModule} from "@nestjs/testing";
import {ModelsService} from "../services/models.service";
import {ModelsRepository} from "../repositories/models.repository";

describe('Agent Tests', () => {
    let testingModule: TestingModule;
    beforeAll(async () => {
        testingModule = await Test.createTestingModule({
            // imports: [
            //     TypeOrmModule.forRoot({
            //         type: 'postgres', // or your database type
            //         host: 'localhost',
            //         port: 5432,
            //         username: 'test_user',
            //         password: 'test_password',
            //         database: 'test_database',
            //         entities: [Model],
            //         synchronize: true,
            //     }),
            //     TypeOrmModule.forFeature([Model]),
            // ],
            providers: [ModelsService, ModelsRepository],
        }).compile();


    });
    describe('Planner Agent', ()=>{

        it('It should create plans', async () => {
            const modelsService = testingModule.get<ModelsService>(ModelsService);
            const result = await  modelsService.getAllModelsForMember('1');
            console.log(`result: `, result);
        });
    });
});