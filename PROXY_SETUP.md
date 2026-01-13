# IP Proxy Setup Guide

## Problem
Rumble detects bot activity when all comments come from the same IP address. The solution is to route comments through different proxy IPs.

## Solution Overview
The `proxyRotation.ts` service rotates through proxy IPs to mask the bot's origin. Each comment can be posted from a different IP address, making it appear as if multiple users are commenting.

## Supported Proxy Providers

### 1. iProyal (Recommended)
- **Website**: https://iproyal.com
- **Pricing**: ~$0.80-$3/GB depending on plan
- **Features**: Residential proxies, good for Rumble
- **Setup**: 
  ```
  IPROYAL_PROXIES=proxy1.iproyal.com:12321,proxy2.iproyal.com:12321,proxy3.iproyal.com:12321
  ```

### 2. Bright Data (formerly Luminati)
- **Website**: https://brightdata.com
- **Pricing**: ~$0.50-$2/GB
- **Features**: Residential and datacenter proxies
- **Setup**:
  ```
  BRIGHT_DATA_PROXIES=proxy1.brightdata.com:22225,proxy2.brightdata.com:22225
  ```

### 3. Oxylabs
- **Website**: https://oxylabs.io
- **Pricing**: ~$1-$5/GB
- **Features**: Premium residential proxies
- **Setup**:
  ```
  CUSTOM_PROXIES=proxy1.oxylabs.com:7777,proxy2.oxylabs.com:7777
  ```

### 4. Custom Proxies
For any other proxy service:
```
CUSTOM_PROXIES=proxy1.example.com:8080,proxy2.example.com:8080
```

## Environment Variables

Add to your `.env` file:

```env
# iProyal Proxies (comma-separated list)
IPROYAL_PROXIES=proxy1.iproyal.com:12321,proxy2.iproyal.com:12321,proxy3.iproyal.com:12321

# Bright Data Proxies (comma-separated list)
BRIGHT_DATA_PROXIES=proxy1.brightdata.com:22225,proxy2.brightdata.com:22225

# Custom Proxies (comma-separated list)
CUSTOM_PROXIES=proxy1.example.com:8080,proxy2.example.com:8080
```

## Proxy URL Format

Proxies should be in one of these formats:

```
# Without authentication
proxy.example.com:8080

# With authentication
username:password@proxy.example.com:8080

# With protocol
http://proxy.example.com:8080
https://proxy.example.com:8080
socks5://proxy.example.com:1080
```

## How It Works

1. **Initialization**: When the app starts, `proxyRotation` reads proxy URLs from environment variables
2. **Rotation**: Each time a comment is posted, the service provides the next proxy in the list
3. **Provider Switching**: After cycling through all proxies in one provider, it switches to the next provider
4. **Random Selection**: For concurrent requests, use `getRandomProxy()` instead of `getNextProxy()`

## Integration with Comment Posting

The proxy service is automatically integrated into `directRumbleAPI.ts`:

```typescript
import { proxyRotation } from './proxyRotation';

// Get next proxy for this request
const proxy = proxyRotation.getNextProxy();

// Use proxy when making HTTP requests
const response = await fetch(url, {
  agent: proxy ? new HttpProxyAgent(proxyRotation.proxyToUrl(proxy)) : undefined,
});
```

## Cost Estimation

For a typical stream with 100 comments/hour:

- **iProyal**: ~$0.01-0.05/hour (100-500MB/hour)
- **Bright Data**: ~$0.005-0.02/hour
- **Oxylabs**: ~$0.02-0.10/hour

Monthly cost for 8 hours/day streaming: **$2.40 - $24** depending on provider and plan.

## Best Practices

1. **Use Residential Proxies**: Datacenter proxies are more likely to be detected by Rumble
2. **Rotate Regularly**: Don't post multiple comments from the same IP consecutively
3. **Monitor Health**: Check proxy health regularly (implement health checks)
4. **Vary User Agents**: Combine with different browser user agents for better masking
5. **Respect Rate Limits**: Don't post too many comments too quickly
6. **Use Multiple Accounts**: Combine proxy rotation with multiple Rumble accounts

## Testing Proxies

To test if your proxies are working:

```bash
# Test a single proxy
curl -x http://proxy.example.com:8080 https://api.ipify.org

# Should return a different IP address than your server's IP
```

## Troubleshooting

### "No proxy providers configured"
- Check that environment variables are set correctly
- Verify proxy URLs are in correct format
- Restart the application after changing environment variables

### Proxies not rotating
- Check `proxyRotation.getStats()` to see current state
- Verify proxies are actually working with curl test
- Check server logs for proxy errors

### Rumble still detecting bot activity
- Use residential proxies instead of datacenter
- Increase delay between comments (use `commentInterval` setting)
- Vary comment styles and content more
- Use multiple Rumble accounts
- Consider adding random delays between 0-5 seconds

## Advanced Configuration

### Custom Proxy Validation

Add to `proxyRotation.ts` if needed:

```typescript
async validateProxy(proxy: ProxyConfig): Promise<boolean> {
  try {
    const response = await fetch('https://api.ipify.org', {
      agent: new HttpProxyAgent(this.proxyToUrl(proxy)),
      timeout: 5000,
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
```

### Health Check Service

```typescript
startHealthChecks() {
  setInterval(() => {
    this.providers.forEach((provider, name) => {
      provider.proxies.forEach(async (proxy) => {
        const isHealthy = await this.validateProxy(proxy);
        if (!isHealthy) {
          console.warn(`[ProxyRotation] Proxy ${proxy.host} is down`);
        }
      });
    });
  }, 300000); // Every 5 minutes
}
```

## Next Steps

1. Choose a proxy provider (iProyal recommended for Rumble)
2. Set up account and get proxy credentials
3. Add environment variables to your deployment
4. Test with `curl` to verify proxies work
5. Deploy and test with a live stream
6. Monitor Rumble for bot detection messages

## Support

If you continue to get bot detection warnings:
1. Check proxy rotation is working: `proxyRotation.getStats()`
2. Verify proxies are residential (not datacenter)
3. Increase `commentInterval` to 60-120 seconds
4. Use different comment styles and content
5. Contact proxy provider support if proxies are being blocked
