import {Injectable} from "@nestjs/common";
import { Model, SearchResult, SearchResultResponse } from '../models/api/conversationApiModels';
import {Browser, BrowserContext, Page} from 'playwright';
import {Subject} from "rxjs";
import {wait} from "../utils/utils";
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();

@Injectable()
export class DuckduckgoSearchService {
    private browser;


    async main(prompt:string ): Promise<string>{
        //duckduckgo has headless mode detection and throws an error.  use stealth to circumvent.
        chromium.use(stealth);
        if (!this.browser || this.browser.isConnected() === false) {
            this.browser = await chromium.launch({
                headless: false,
                args: ['--disable-blink-features=AutomationControlled'],
            });
        }
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

        const context = await this.browser.newContext({
            userAgent,
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 1
        });
        const page = await context.newPage();
        try {
            await page.goto(`https://chatgpt.com/`);
            await page.waitForLoadState('domcontentloaded', {timeout: 1 * 1000});
            const askTextarea = await page.locator('textarea[placeholder="Ask anything"][data-virtualkeyboard="true"]');
            await askTextarea.fill(prompt);
            await askTextarea.press('Enter');
            fetch("https://chatgpt.com/backend-api/conversation", {
                "headers": {
                    "accept": "text/event-stream",
                    "accept-language": "en-US,en;q=0.9",
                    "authorization": "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjE5MzQ0ZTY1LWJiYzktNDRkMS1hOWQwLWY5NTdiMDc5YmQwZSIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MSJdLCJjbGllbnRfaWQiOiJhcHBfWDh6WTZ2VzJwUTl0UjNkRTduSzFqTDVnSCIsImV4cCI6MTc0MzQ3NDMzOSwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7InVzZXJfaWQiOiJ1c2VyLTVOT21UY1FYQ2xLb21OZjlpVFh5bXVqTiJ9LCJodHRwczovL2FwaS5vcGVuYWkuY29tL3Byb2ZpbGUiOnsiZW1haWwiOiJqYXNvbmxtY2FmZmVlQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwiaWF0IjoxNzQyNjEwMzM5LCJpc3MiOiJodHRwczovL2F1dGgub3BlbmFpLmNvbSIsImp0aSI6ImNkZjJlZTgxLTQ5M2UtNDI0ZS05MDFlLTdkOGJhYTY0YjAxMyIsIm5iZiI6MTc0MjYxMDMzOSwicHdkX2F1dGhfdGltZSI6MTc0MTc0NDY3MDYzOSwic2NwIjpbIm9wZW5pZCIsImVtYWlsIiwicHJvZmlsZSIsIm9mZmxpbmVfYWNjZXNzIiwibW9kZWwucmVxdWVzdCIsIm1vZGVsLnJlYWQiLCJvcmdhbml6YXRpb24ucmVhZCIsIm9yZ2FuaXphdGlvbi53cml0ZSJdLCJzZXNzaW9uX2lkIjoiYXV0aHNlc3NfWnA1RmJGMnFMd1pnN3VsYnJraVZacTFWIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMTA5MTI3NDc5NTAxNzY2ODQxNjUifQ.sC7yQIA-TTiaG9wGVfKEVua1ST5tv6zLZ3omG0yZZUeQ7U3L3ewXUnARVCK3HzCNSRjdw4etlSUeOihyVjI7eyb6yiOkz-nnaAFcqUZjLfr012mJardm1yxL6Ml-CgFo64PRHg6T4eWnnSueCTFzZnTFzJe-vKqHQ2qXeIjekiP2Dl_V_ahn2KE2_jWyT5C4agTakioznvAXrmiNxs-m_huBBMHpM9JMYwULAOBvhKg1GVaRrRyRru9uaC9FnsqFk-k5yHi7DRL9mm0pR7OFKFDULUSyf29lFnMZujeeUz7OIhCw5RWJ3fOj9NO3r2G9wM_gmU_gi4ETPb7dPedHb0GnrYHcadiitJQpnIjMAxdVZ6Vv9JXHtITKx0qfOkVggHN9kPipFdtHPUuQzi5Y1tlCU1XRYALdIB2KGix5FVMGLpK8PYRmGk2xA2kz-eGcL16Fr876V5cMTrTPWf3_HrM0a4FP10iFWAqr1jdNbZwKvBpFL74RUKZ2ETpPTltGKCAFlqcSbtcxKPB0FrGyzrLxd1hmG2b97O67IRzj0NyoSzmDlDba2qdgL9QUlnkonbiteRuI4oK_OYt2up73sAYE961NMMQEPi6LCcANKix8WjAMG89i5CS3-WxjOd29hOpB4qP5qAw--zxdJ5eBZp7Q52l41jqoiEClzBTPPGY",
                    "content-type": "application/json",
                    "oai-device-id": "94c4b26d-f091-4680-8aee-d24f9ea8cb95",
                    "oai-echo-logs": "0,530,1,3271,0,96432,1,101251,0,102777,1,103987,0,107705,1,107732,0,344567,1,349107",
                    "oai-language": "en-US",
                    "openai-sentinel-chat-requirements-token": "gAAAAABn32BAA0nvxj2UzyLFKtv0vYLgk1mT5j_z93Z-8ERvpI8EjGdcDD7s7i7SfGMF8Ba95qupJ5j4oD8JAn66e4e_w2U61qVIggmTurjhXsYSuAd_c3VtUtZGyORsvn_swA5RrEBbsHIdbVAMtSNQVKsaumO73PCVB4lH9ajfv_OvGwLyi1H36g2-XhrQs8MXgcS-0mnltIFJK7pfosqUxIXMAH8COSGQvLroZ-p0rzW8mP8Ms3uVsXp9ChlErO3wHa6dECoMmFjRoHnZH8PjpUekG0qINZVGe_Wau7NnHz_dMcpcZ2ylrczqmrEHMIWTl4XhuvotstuoXAgJoMZBqlKmp4yO6w7tbI8UYYgjh7lK61BnFLiOUcDz17Myk7d2lLgSUZRN_O4GMAwWqtImsAXRgNeIQ4LKo17p90Ii5kbYZL17QEmndKyfqj7zly2IvD6khrlg7IovfE_BPa7ncWwBKnmG-cJZ0d4P0J8S5YYKnGvIiqoYKwIsPHvNhbj7KbpAVGqVzrWgBS7PbUMnTnRp2bqwjx_K8N63L8pjELE5xBacLkCxC1mYW-XhSZHEd3kvQhw_PCazuV7KsBCjglY4ecJpHda59VqjKjPbLEc4ue8Y0QtfXO4HZcD6T3yvwTb7Kz_PO1g3Jzu1tz-nRUxnIKhKQfFy8I3s5IeqVX1HIJv3FW-ng5v7M_ZJ7rq5ZfwZd8iihQRlfzPIX0TYz9ojSpK6PpbuNth26URiuHFzo-M6Ei6ELiHMk6hdnBC9O8EJShzIaQlzXAIafMN5ZTAGJ2xqXFSWIvGLgO8rFdj6-hogYCh1_P-VYvDiE4Pwkc2oXyfiJIpcXCOXR-QfQkJm4qIIzqLqQoEhGG8lmar-bezW07MET5i6m5kpYJR-7nURR9BWzPrbDv_HZmr56k-7mfZh8w7Td0XrWKW3M1bWBpgaXfzSSK1_pvbIKgiBKHZaLRHteJ2iMLqtX0eEingK7buDyz5mJgFnG52Bi8-kgU2Dxcdv0lClJXkkND1eoKRLgb2gTy3hrexTZSP3m4tld5ly7kxVJ5AgyJun7lmcme02bp9KBwXGmn4CJXSiQnShsCQNCSGan59iAJZzIVOrnpqvR_gl88JcwaTa7Tln9khllnImM35xvEmcaqViuawvx4smXDjLhUtWV1F3GlpgLQZxBcAqF6mynouWYQMYxP5EAGI6lEYCIf9HiS0m-Mq_fhzagvgEF19xqQMdxGlglQ5l0kxxG8frxjCk_CAQRu3Peypg-P2TtQ9bwlFhwu1K3TFOoYtTExMsnlYbZ9cK2aQ5u6ZfJ5yCT8G6Uvn6byQcOcm1F1PoZgeVKy1qCW4-m5OqVIq42WwYMdt9xjsgJm9nzkY7IZsFjSUOpmAznxAbO0EpqgIpzmKUMx2w9XOExrHsidGifRzf5hQDeIFxzMSo18RTeDy4DsGxyFWYTl0Na9nigaAMgz5aenvkibKCYG2VHO4TGAgXAnhsmEwlAkhQmw62iimzoFm7b_RzCMulkJYaus0uFuOiOzsylbjfnpw0F6ntkE5xtjobeidWcXfE8Ygh7UMW0l7JRXop7yVstm8=",
                    "openai-sentinel-proof-token": "gAAAAABWzI0OTQsIlNhdCBNYXIgMjIgMjAyNSAxOToxMzozNiBHTVQtMDYwMCAoTW91bnRhaW4gRGF5bGlnaHQgVGltZSkiLDQyOTQ3MDUxNTIsNDMsIk1vemlsbGEvNS4wIChNYWNpbnRvc2g7IEludGVsIE1hYyBPUyBYIDEwXzE1XzcpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMzQuMC4wLjAgU2FmYXJpLzUzNy4zNiIsbnVsbCwicHJvZC05ZTkwOGYzNzMzM2Y0ZTRmNjM4YmM1YTNjMjcwNTU3NGI5NzAyODY0IiwiZW4tVVMiLCJlbi1VUyxlbiIsOCwibWVkaWFDYXBhYmlsaXRpZXPiiJJbb2JqZWN0IE1lZGlhQ2FwYWJpbGl0aWVzXSIsIl9fcmVhY3RDb250YWluZXIkOGxtZGQxeDJtOGUiLCJvbmJlZm9yZXByaW50Iiw0MDc5OTEuNjAwMDAwMTQzMDUsIjk0MjYxMjA5LWYyMzQtNDQ4OS1iZmRmLWUxZjQ1M2JlMDIzOSIsIiIsMTAsMTc0MjY5MjAwODA1Ni4zXQ==",
                    "openai-sentinel-turnstile-token": "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",
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Google Chrome\";v=\"134\"",
                    "sec-ch-ua-arch": "\"arm\"",
                    "sec-ch-ua-bitness": "\"64\"",
                    "sec-ch-ua-full-version": "\"134.0.6998.89\"",
                    "sec-ch-ua-full-version-list": "\"Chromium\";v=\"134.0.6998.89\", \"Not:A-Brand\";v=\"24.0.0.0\", \"Google Chrome\";v=\"134.0.6998.89\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-model": "\"\"",
                    "sec-ch-ua-platform": "\"macOS\"",
                    "sec-ch-ua-platform-version": "\"15.0.0\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin"
                },
                "referrer": "https://chatgpt.com/c/67df603e-7e64-800b-ac70-9095cdfd53ba",
                "referrerPolicy": "strict-origin-when-cross-origin",
                "body": "{\"action\":\"next\",\"messages\":[{\"id\":\"4f427222-723c-49e2-9ef8-d0437814ba9d\",\"author\":{\"role\":\"user\"},\"create_time\":1742692510.693,\"content\":{\"content_type\":\"text\",\"parts\":[\"tell me a longer one\"]},\"metadata\":{\"serialization_metadata\":{\"custom_symbol_offsets\":[]},\"dictation\":false}}],\"conversation_id\":\"67df603e-7e64-800b-ac70-9095cdfd53ba\",\"parent_message_id\":\"5a9b3c09-041b-485d-888a-c45424714dda\",\"model\":\"auto\",\"timezone_offset_min\":360,\"timezone\":\"America/Denver\",\"conversation_mode\":{\"kind\":\"primary_assistant\"},\"enable_message_followups\":true,\"system_hints\":[],\"supports_buffering\":true,\"supported_encodings\":[\"v1\"],\"client_contextual_info\":{\"is_dark_mode\":true,\"time_since_loaded\":502,\"page_height\":863,\"page_width\":866,\"pixel_ratio\":2,\"screen_height\":982,\"screen_width\":1512},\"paragen_cot_summary_display_override\":\"allow\"}",
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            });
            return '';
        } catch (error) {
            console.error('loading chatgpt failed:', error);
            throw error;
        } finally {
            page.close();
            context.close();
        }
    }
}


