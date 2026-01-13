/**
 * Proxy Rotation Service
 * 
 * Rotates through proxy IPs to avoid bot detection based on single IP address
 * Supports iProyal, Bright Data, Oxylabs, and other proxy services
 */

export interface ProxyConfig {
  protocol: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ProxyProvider {
  name: string;
  proxies: ProxyConfig[];
  currentIndex: number;
  healthCheckInterval: number;
  lastHealthCheck: number;
}

class ProxyRotationService {
  private providers: Map<string, ProxyProvider> = new Map();
  private currentProvider: string | null = null;
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeProxies();
  }

  private initializeProxies() {
    // Parse proxy configuration from environment variables
    const iproyalProxies = process.env.IPROYAL_PROXIES?.split(',').filter(Boolean) || [];
    const brightDataProxies = process.env.BRIGHT_DATA_PROXIES?.split(',').filter(Boolean) || [];
    const customProxies = process.env.CUSTOM_PROXIES?.split(',').filter(Boolean) || [];

    if (iproyalProxies.length > 0) {
      this.providers.set('iproyal', {
        name: 'iProyal',
        proxies: iproyalProxies.map(proxy => this.parseProxyUrl(proxy)),
        currentIndex: 0,
        healthCheckInterval: 300000, // 5 minutes
        lastHealthCheck: 0,
      });
    }

    if (brightDataProxies.length > 0) {
      this.providers.set('brightdata', {
        name: 'Bright Data',
        proxies: brightDataProxies.map(proxy => this.parseProxyUrl(proxy)),
        currentIndex: 0,
        healthCheckInterval: 300000,
        lastHealthCheck: 0,
      });
    }

    if (customProxies.length > 0) {
      this.providers.set('custom', {
        name: 'Custom',
        proxies: customProxies.map(proxy => this.parseProxyUrl(proxy)),
        currentIndex: 0,
        healthCheckInterval: 300000,
        lastHealthCheck: 0,
      });
    }

    // Set first available provider as current
    if (this.providers.size > 0) {
      this.currentProvider = Array.from(this.providers.keys())[0];
    }
  }

  private parseProxyUrl(url: string): ProxyConfig {
    try {
      const proxyUrl = new URL(`http://${url}`);
      return {
        protocol: (proxyUrl.protocol.replace(':', '') as 'http' | 'https' | 'socks5') || 'http',
        host: proxyUrl.hostname || '',
        port: parseInt(proxyUrl.port) || 80,
        username: proxyUrl.username || undefined,
        password: proxyUrl.password || undefined,
      };
    } catch (error) {
      console.error('[ProxyRotation] Failed to parse proxy URL:', url, error);
      throw new Error(`Invalid proxy URL: ${url}`);
    }
  }

  /**
   * Get the next proxy in rotation
   */
  getNextProxy(): ProxyConfig | null {
    if (!this.currentProvider) {
      console.warn('[ProxyRotation] No proxy providers configured');
      return null;
    }

    const provider = this.providers.get(this.currentProvider);
    if (!provider || provider.proxies.length === 0) {
      console.warn('[ProxyRotation] No proxies available in current provider');
      return null;
    }

    // Rotate to next proxy
    const proxy = provider.proxies[provider.currentIndex];
    provider.currentIndex = (provider.currentIndex + 1) % provider.proxies.length;

    // Switch to next provider if we've cycled through all proxies
    if (provider.currentIndex === 0 && this.providers.size > 1) {
      const providers = Array.from(this.providers.keys());
      const currentIdx = providers.indexOf(this.currentProvider);
      this.currentProvider = providers[(currentIdx + 1) % providers.length];
    }

    return proxy;
  }

  /**
   * Get a random proxy (useful for concurrent requests)
   */
  getRandomProxy(): ProxyConfig | null {
    if (!this.currentProvider) return null;

    const provider = this.providers.get(this.currentProvider);
    if (!provider || provider.proxies.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * provider.proxies.length);
    return provider.proxies[randomIndex];
  }

  /**
   * Convert proxy config to URL format for HTTP clients
   */
  proxyToUrl(proxy: ProxyConfig): string {
    const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : '';
    return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
  }

  /**
   * Get proxy configuration for axios/fetch
   */
  getProxyConfig(proxy: ProxyConfig): any {
    return {
      protocol: proxy.protocol,
      hostname: proxy.host,
      port: proxy.port,
      auth: proxy.username && proxy.password ? {
        username: proxy.username,
        password: proxy.password,
      } : undefined,
    };
  }

  /**
   * Get all available proxies count
   */
  getTotalProxies(): number {
    let total = 0;
    this.providers.forEach((provider) => {
      total += provider.proxies.length;
    });
    return total;
  }

  /**
   * Get provider statistics
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.providers.forEach((provider, name) => {
      stats[name] = {
        proxyCount: provider.proxies.length,
        currentIndex: provider.currentIndex,
        name: provider.name,
      };
    });
    return stats;
  }

  /**
   * Check if proxies are configured
   */
  isConfigured(): boolean {
    return this.providers.size > 0 && this.getTotalProxies() > 0;
  }
}

// Export singleton instance
export const proxyRotation = new ProxyRotationService();
