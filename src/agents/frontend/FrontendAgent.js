/**
 * Frontend Agent - Mobile-First UI Management
 * Handles all frontend components, routing, and UI state
 */

import BaseAgent from '../BaseAgent.js';

class FrontendAgent extends BaseAgent {
  constructor() {
    super('FrontendAgent', {
      theme: 'mobile-first',
      breakpoints: {
        mobile: '640px',
        tablet: '768px',
        desktop: '1024px'
      }
    });
    
    this.components = new Map();
    this.routes = new Map();
    this.theme = null;
    this.deviceInfo = null;
  }

  async initialize() {
    try {
      this.setStatus('initializing');
      
      // Initialize device detection
      await this.detectDevice();
      
      // Initialize theme system
      await this.initializeTheme();
      
      // Initialize component registry
      await this.initializeComponents();
      
      // Initialize routing
      await this.initializeRouting();
      
      // Setup responsive utilities
      await this.setupResponsiveUtilities();
      
      this.initialized = true;
      this.setStatus('ready');
      this.log('Frontend agent initialized successfully');
      
    } catch (error) {
      this.handleError(error, 'initialization');
      throw error;
    }
  }

  /**
   * Detect device type and capabilities
   */
  async detectDevice() {
    const userAgent = navigator.userAgent;
    const screenWidth = window.innerWidth;
    
    this.deviceInfo = {
      isMobile: screenWidth < 768,
      isTablet: screenWidth >= 768 && screenWidth < 1024,
      isDesktop: screenWidth >= 1024,
      isIOS: /iPad|iPhone|iPod/.test(userAgent),
      isAndroid: /Android/.test(userAgent),
      screenWidth,
      screenHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      touchSupport: 'ontouchstart' in window,
      safeArea: this.getSafeArea()
    };
    
    this.log('Device detected', this.deviceInfo);
  }

  /**
   * Get safe area for mobile devices
   */
  getSafeArea() {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
      right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
      bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0')
    };
  }

  /**
   * Initialize theme system
   */
  async initializeTheme() {
    this.theme = {
      current: 'light',
      role: null, // 'owner' or 'walker'
      colors: {
        owner: {
          primary: '#10b981',
          secondary: '#059669',
          accent: '#34d399',
          background: '#ffffff',
          surface: '#f3f4f6'
        },
        walker: {
          primary: '#000000',
          secondary: '#374151',
          accent: '#6b7280',
          background: '#ffffff',
          surface: '#f9fafb'
        }
      },
      breakpoints: this.config.breakpoints
    };
    
    this.log('Theme system initialized');
  }

  /**
   * Initialize component registry
   */
  async initializeComponents() {
    // Core UI components
    this.components.set('MobileLayout', {
      path: '/layouts/MobileLayout',
      type: 'layout',
      props: ['children', 'userRole']
    });
    
    this.components.set('Button', {
      path: '/components/ui/Button',
      type: 'component',
      props: ['variant', 'size', 'disabled', 'onClick']
    });
    
    this.components.set('Input', {
      path: '/components/ui/Input',
      type: 'component',
      props: ['type', 'placeholder', 'value', 'onChange']
    });
    
    this.components.set('Card', {
      path: '/components/ui/Card',
      type: 'component',
      props: ['children', 'className']
    });
    
    this.components.set('Modal', {
      path: '/components/ui/Modal',
      type: 'component',
      props: ['isOpen', 'onClose', 'children']
    });
    
    // Business components
    this.components.set('WalkerCard', {
      path: '/components/WalkerCard',
      type: 'business',
      props: ['walker', 'onSelect']
    });
    
    this.components.set('BookingCard', {
      path: '/components/BookingCard',
      type: 'business',
      props: ['booking', 'onCancel', 'onTrack']
    });
    
    this.components.set('MessageBubble', {
      path: '/components/MessageBubble',
      type: 'business',
      props: ['message', 'isOwn']
    });
    
    this.log('Component registry initialized', { count: this.components.size });
  }

  /**
   * Initialize routing system
   */
  async initializeRouting() {
    this.routes.set('/', {
      component: 'Home',
      protected: true,
      roles: ['owner']
    });
    
    this.routes.set('/walker', {
      component: 'HomeWalker',
      protected: true,
      roles: ['walker']
    });
    
    this.routes.set('/login', {
      component: 'Login',
      protected: false,
      roles: []
    });
    
    this.routes.set('/booking', {
      component: 'Booking',
      protected: true,
      roles: ['owner']
    });
    
    this.routes.set('/wallet', {
      component: 'Wallet',
      protected: true,
      roles: ['owner', 'walker']
    });
    
    this.routes.set('/messages', {
      component: 'Messages',
      protected: true,
      roles: ['owner', 'walker']
    });
    
    this.routes.set('/live-walk', {
      component: 'LiveWalk',
      protected: true,
      roles: ['owner', 'walker']
    });
    
    this.log('Routing system initialized', { routes: this.routes.size });
  }

  /**
   * Setup responsive utilities
   */
  async setupResponsiveUtilities() {
    // Add responsive classes to document
    if (this.deviceInfo.isMobile) {
      document.body.classList.add('mobile-device');
    }
    
    if (this.deviceInfo.isIOS) {
      document.body.classList.add('ios-device');
    }
    
    if (this.deviceInfo.isAndroid) {
      document.body.classList.add('android-device');
    }
    
    // Setup viewport handling
    this.setupViewportHandling();
    
    this.log('Responsive utilities setup');
  }

  /**
   * Setup viewport handling for mobile
   */
  setupViewportHandling() {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    // Handle keyboard resize on mobile
    if (this.deviceInfo.isMobile) {
      window.addEventListener('resize', () => {
        if (window.innerHeight < this.deviceInfo.screenHeight * 0.8) {
          document.body.classList.add('keyboard-open');
        } else {
          document.body.classList.remove('keyboard-open');
        }
      });
    }
  }

  /**
   * Apply theme based on user role
   * @param {string} role - User role ('owner' or 'walker')
   */
  applyTheme(role) {
    this.theme.role = role;
    const colors = this.theme.colors[role];
    
    // Apply CSS custom properties
    const root = document.documentElement;
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-surface', colors.surface);
    
    // Update body class
    document.body.className = document.body.className.replace(/theme-\w+/, '');
    document.body.classList.add(`theme-${role}`);
    
    this.log('Theme applied', { role });
  }

  /**
   * Get component by name
   * @param {string} name - Component name
   * @returns {Object} Component info
   */
  getComponent(name) {
    return this.components.get(name);
  }

  /**
   * Get route by path
   * @param {string} path - Route path
   * @returns {Object} Route info
   */
  getRoute(path) {
    return this.routes.get(path);
  }

  /**
   * Check if route is accessible
   * @param {string} path - Route path
   * @param {string} userRole - User role
   * @returns {boolean} Is accessible
   */
  isRouteAccessible(path, userRole) {
    const route = this.routes.get(path);
    if (!route) return false;
    
    if (route.protected && !userRole) return false;
    if (route.roles.length > 0 && !route.roles.includes(userRole)) return false;
    
    return true;
  }

  /**
   * Get device info
   * @returns {Object} Device information
   */
  getDeviceInfo() {
    return this.deviceInfo;
  }

  /**
   * Get current theme
   * @returns {Object} Theme information
   */
  getTheme() {
    return this.theme;
  }

  /**
   * Create responsive styles
   * @param {Object} styles - Style object
   * @returns {string} CSS string
   */
  createResponsiveStyles(styles) {
    let css = '';
    
    // Base styles
    if (styles.base) {
      css += styles.base;
    }
    
    // Mobile styles (default)
    if (styles.mobile) {
      css += styles.mobile;
    }
    
    // Tablet styles
    if (styles.tablet) {
      css += `@media (min-width: ${this.theme.breakpoints.tablet}) { ${styles.tablet} }`;
    }
    
    // Desktop styles
    if (styles.desktop) {
      css += `@media (min-width: ${this.theme.breakpoints.desktop}) { ${styles.desktop} }`;
    }
    
    return css;
  }

  async shutdown() {
    this.setStatus('shutting down');
    
    // Cleanup event listeners
    window.removeEventListener('resize', this.setupViewportHandling);
    
    // Clear registries
    this.components.clear();
    this.routes.clear();
    
    this.initialized = false;
    this.setStatus('shutdown');
    this.log('Frontend agent shutdown');
  }
}

export default FrontendAgent;