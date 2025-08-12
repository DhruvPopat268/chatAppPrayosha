"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Phone,
  Video,
  Paperclip,
  Send,
  Search,
  MoreVertical,
  Smile,
  Mic,
  ImageIcon,
  File,
  PhoneOff,
  VideoOff,
  MicOff,
  Trash2,
  UserPlus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Camera,
  Edit,
  Save,
  X,
  Loader2,
  Bell,
  ChevronDown,
  MessageSquare,
  Bug,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getCurrentUser, authenticatedFetch, logout, apiCall, checkSessionStatus, handleAuthError } from "@/lib/clientAuth"
import socketManager from "@/lib/socket"
import config from "@/lib/config"
import WebRTCManager from "@/lib/webrtc"
import type { CallState } from "@/lib/webrtc"
import { useRouter } from 'next/navigation';

// Dynamic import for OneSignal to prevent SSR issues
let OneSignal: any = null;
let OneSignalInitialized = false;

// Initialize OneSignal with proper error handling and IndexedDB setup
const initializeOneSignal = async () => {
  if (OneSignalInitialized) return OneSignal;

  try {
    console.log('🔄 Starting OneSignal initialization...');

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('⚠️ Not in browser environment, skipping OneSignal init');
      return null;
    }

    // Check if OneSignal is already available globally
    if (window.OneSignal) {
      console.log('✅ OneSignal already available globally');
      OneSignal = window.OneSignal;
      OneSignalInitialized = true;
      return OneSignal;
    }

    // Import OneSignal module
    const module = await import('react-onesignal');
    OneSignal = module.default;

    // Check environment configuration
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) {
      console.error('❌ OneSignal App ID not configured');
      return null;
    }

    console.log('🔧 Initializing OneSignal with App ID:', appId);

    // Clear any existing OneSignal IndexedDB to start fresh
    try {
      await clearOneSignalIndexedDB();
      console.log('✅ Cleared existing OneSignal IndexedDB');
    } catch (clearError) {
      console.log('⚠️ Could not clear OneSignal IndexedDB:', clearError);
    }

    // Initialize OneSignal with proper configuration
    await OneSignal.init({
      appId: appId,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      serviceWorkerParam: { scope: '/' },
      // Enable features needed for proper initialization
      notifyButton: {
        enable: false,
      },
      welcomeNotification: {
        disable: true,
      },
      // Enable auto-registration to ensure proper setup
      autoRegister: true,
      autoResubscribe: true,
      persistNotification: false,
      // Add proper timeout
      timeout: 15000,
      // Ensure proper subscription setup
      promptOptions: {
        slidedown: {
          prompts: [
            {
              type: "push",
              autoPrompt: true,
              text: {
                actionMessage: "We'd like to show you notifications for the latest updates.",
                acceptButton: "Allow",
                cancelButton: "Not now"
              },
              delay: {
                pageViews: 1,
                timeDelay: 20
              }
            }
          ]
        }
      },
      // Enhanced notification settings for better display
      notificationClickHandlerMatch: 'origin',
      notificationClickHandlerAction: 'focus',
      // Enable sound and vibration for better notification visibility
      notificationLaunchUrl: window.location.origin,
      // Configure for better mobile experience
      safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
      // Enable native prompts for better permission handling
      native_prompt_enabled: true,
      // Configure notification display
      notificationDisplayOptions: {
        // Enable sound for notifications
        sound: true,
        // Enable vibration
        vibration: true,
        // Show notification even when app is in focus
        showWhenInFocus: true,
        // Enable notification badges
        badge: true
      }
    });

    console.log('✅ OneSignal initialized successfully');

    // Wait for OneSignal to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if user is subscribed
    const isSubscribed = await OneSignal.User.pushSubscription.optedIn;
    console.log('📱 User subscription status:', isSubscribed);

    OneSignalInitialized = true;
    return OneSignal;
  } catch (error) {
    console.error('❌ Error initializing OneSignal:', error);
    return null;
  }
};

// Helper to clear OneSignal IndexedDB
const clearOneSignalIndexedDB = async () => {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve();
      return;
    }

    const request = indexedDB.open('ONE_SIGNAL_SDK_DB');

    request.onsuccess = () => {
      const db = request.result;
      db.close();

      const deleteRequest = indexedDB.deleteDatabase('ONE_SIGNAL_SDK_DB');

      deleteRequest.onsuccess = () => {
        console.log('✅ OneSignal IndexedDB cleared');
        resolve();
      };

      deleteRequest.onerror = () => {
        console.log('⚠️ Could not clear OneSignal IndexedDB');
        resolve(); // Don't fail the initialization
      };
    };

    request.onerror = () => {
      console.log('⚠️ Could not open OneSignal IndexedDB for clearing');
      resolve(); // Don't fail the initialization
    };
  });
};

interface Contact {
  id: string
  name: string
  avatar: string
  lastMessage: string
  timestamp: string
  online: boolean
  unread: number
}

interface Message {
  id: string
  senderId: string
  receiverId?: string
  content: string
  timestamp: string
  type: "text" | "image" | "file" | "voice" | "link"
  fileName?: string
  fileSize?: string
  // 🔥 NEW: Add read status for read receipts
  isRead?: boolean
  // 🔥 NEW: Add link metadata for hyperlink messages
  linkUrl?: string
  linkTitle?: string
  linkDescription?: string
  linkImage?: string
}

interface ApiUser {
  _id: string
  username: string
  email: string
  createdAt: string
  updatedAt: string
}

interface CurrentUser {
  id: string
  username: string
  avatar: string
  email: string
  bio: string
}

// 🔥 NEW: Utility functions for hyperlink detection and processing
const isUrl = (text: string): boolean => {
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  return urlRegex.test(text);
};

const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

const getLinkPreview = async (url: string) => {
  try {
    // For now, we'll create a simple preview
    // In a production app, you might want to use a link preview service
    const domain = new URL(url).hostname;
    return {
      title: domain,
      description: `Link to ${domain}`,
      image: null
    };
  } catch (error) {
    return {
      title: 'Invalid URL',
      description: 'Could not load link preview',
      image: null
    };
  }
};

const contacts: Contact[] = [
  {
    id: "1",
    name: "Alice Johnson",
    avatar: "/placeholder.svg?height=40&width=40",
    lastMessage: "Hey, how are you doing?",
    timestamp: "2 min ago",
    online: true,
    unread: 2,
  },
  {
    id: "2",
    name: "Bob Smith",
    avatar: "/placeholder.svg?height=40&width=40",
    lastMessage: "Thanks for the files!",
    timestamp: "1 hour ago",
    online: false,
    unread: 0,
  },
  {
    id: "3",
    name: "Carol Davis",
    avatar: "/placeholder.svg?height=40&width=40",
    lastMessage: "See you tomorrow",
    timestamp: "3 hours ago",
    online: true,
    unread: 1,
  },
]

const initialMessages: Message[] = [


]

export default function ChatPage() {
  const router = useRouter();

  // All state declarations first
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false)
  const [friendSearchQuery, setFriendSearchQuery] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [editedUser, setEditedUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const isSendButtonClickedRef = useRef(false);
  const [searchedUsers, setSearchedUsers] = useState<ApiUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [userContacts, setUserContacts] = useState<Contact[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [messagesReady, setMessagesReady] = useState(false) // Track if messages are properly organized
  const [webrtcManager, setWebrtcManager] = useState<any>(null)
  const [callState, setCallState] = useState<CallState>({
    isIncoming: false,
    isOutgoing: false,
    isConnected: false,
    isMuted: false,
    isSpeakerOn: false,
    isVideoEnabled: true,
    localStream: null,
    remoteStream: null,
    callData: null
  })
  const [incomingCallData, setIncomingCallData] = useState<any>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [contactStatus, setContactStatus] = useState<{ online: boolean, lastSeen?: number }>({ online: false });
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');

  // Add offline detection and connection status tracking
  const [isOnline, setIsOnline] = useState(true);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // 🔥 NEW: Add read receipts state
  const [messageReadStatus, setMessageReadStatus] = useState<Map<string, boolean>>(new Map());
  const [lastReadReceipts, setLastReadReceipts] = useState<Map<string, number>>(new Map());

  // 🔥 NEW: Add reconnection handling state
  const [showReconnectPopup, setShowReconnectPopup] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [wasOffline, setWasOffline] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // All refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const localAudioRef = useRef<HTMLAudioElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Authentication check useEffect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = getCurrentUser();
      if (!user && window.location.pathname !== '/login') {
        router.push('/login');
      }
    }
  }, [router]);

  // Helper to get Subscription ID from IndexedDB with better error handling
  function getSubscriptionIdFromIndexedDB() {
    return new Promise<string>((resolve, reject) => {
      console.log('🗄️ Attempting to access OneSignal IndexedDB...');

      if (typeof window === 'undefined' || !window.indexedDB) {
        reject('❌ IndexedDB not available');
        return;
      }

      const request = indexedDB.open('ONE_SIGNAL_SDK_DB');

      request.onerror = () => {
        console.error('❌ Failed to open OneSignal IndexedDB:', request.error);
        reject('❌ Failed to open IndexedDB: ' + request.error?.message);
      };

      request.onsuccess = () => {
        const db = request.result;
        console.log('✅ OneSignal IndexedDB opened successfully');
        console.log('📊 Database object stores:', db.objectStoreNames);

        // Check if the subscriptions object store exists
        if (!db.objectStoreNames.contains('subscriptions')) {
          console.error('❌ Subscriptions object store not found in IndexedDB');
          console.log('📋 Available object stores:', Array.from(db.objectStoreNames));

          // Try to find any object store that might contain subscription data
          const availableStores = Array.from(db.objectStoreNames);
          console.log('🔍 Searching through available stores for subscription data...');

          // Try to find subscription data in other stores
          for (const storeName of availableStores) {
            try {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              const getAllRequest = store.getAll();

              getAllRequest.onsuccess = () => {
                const data = getAllRequest.result;
                console.log(`📦 Data in ${storeName}:`, data);

                // Look for any object that might contain a subscription ID
                if (data && data.length > 0) {
                  for (const item of data) {
                    if (item.id || item.subscriptionId || item.playerId || item.onesignalId) {
                      const foundId = item.id || item.subscriptionId || item.playerId || item.onesignalId;
                      console.log(`✅ Found potential subscription ID in ${storeName}:`, foundId);
                      resolve(foundId);
                      return;
                    }
                  }
                }
              };

              getAllRequest.onerror = () => {
                console.log(`⚠️ Could not read from ${storeName}:`, getAllRequest.error);
              };
            } catch (error) {
              console.log(`⚠️ Error accessing ${storeName}:`, error);
            }
          }

          reject('❌ Subscriptions object store not found. Available stores: ' + Array.from(db.objectStoreNames).join(', '));
          return;
        }

        try {
          const transaction = db.transaction(['subscriptions'], 'readonly');
          const store = transaction.objectStore('subscriptions');
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const subs = getAllRequest.result;
            console.log('📦 Retrieved subscriptions from IndexedDB:', subs);

            if (subs && subs.length > 0) {
              // Look for subscription ID in various possible formats
              for (const sub of subs) {
                const subscriptionId = sub.id || sub.subscriptionId || sub.playerId || sub.onesignalId;
                if (subscriptionId) {
                  console.log('✅ Found subscription ID:', subscriptionId);
                  resolve(subscriptionId);
                  return;
                }
              }

              console.log('⚠️ No valid subscription ID found in subscriptions store');
              console.log('📋 Available fields in first subscription:', subs[0] ? Object.keys(subs[0]) : 'No data');
            } else {
              console.log('⚠️ No subscriptions found in IndexedDB');
            }

            reject('❌ No subscription ID found in IndexedDB');
          };

          getAllRequest.onerror = () => {
            console.error('❌ Failed to read subscriptions from IndexedDB:', getAllRequest.error);
            reject('❌ Failed to read subscriptions: ' + getAllRequest.error?.message);
          };
        } catch (error) {
          console.error('❌ Error accessing subscriptions object store:', error);
          reject('❌ Error accessing subscriptions: ' + (error instanceof Error ? error.message : String(error)));
        }
      };

      request.onupgradeneeded = (event) => {
        console.log('🔄 IndexedDB upgrade needed');
        const db = (event.target as IDBOpenDBRequest).result;

        // Check if subscriptions store exists, if not create it
        if (!db.objectStoreNames.contains('subscriptions')) {
          console.log('📝 Creating subscriptions object store...');
          db.createObjectStore('subscriptions', { keyPath: 'id' });
        }
      };
    });
  }

  const getAndSaveSubscriptionId = async () => {
    console.log('🚀 Starting getAndSaveSubscriptionId...');
    console.log('👤 Current user:', currentUser);

    try {
      // Initialize OneSignal first
      const oneSignalInstance = await initializeOneSignal();

      if (oneSignalInstance) {
        console.log('🔍 Trying OneSignal direct method...');
        try {
          // Check if push is supported
          const isSubscribed = await oneSignalInstance.Notifications.isPushSupported();
          console.log('📱 Push supported:', isSubscribed);

          if (isSubscribed) {
            // Check current permission status
            const permission = await oneSignalInstance.Notifications.permission;
            console.log('🔔 Current permission:', permission);

            // Request permission if not already granted
            if (permission === 'default' || permission === false) {
              console.log('🔔 Requesting notification permission...');
              const newPermission = await oneSignalInstance.Notifications.requestPermission();
              console.log('🔔 New permission status:', newPermission);

              // Wait for permission to be processed and OneSignal to update
              await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Wait for OneSignal to be fully ready
            await oneSignalInstance.User.pushSubscription.optedIn;

            // Try to get Player ID using the correct OneSignal SDK methods
            let playerId = null;

            // Method 1: Get from User's OneSignal ID
            try {
              playerId = await oneSignalInstance.User.getOneSignalId();
              console.log('🎯 Method 1 - User OneSignal ID:', playerId);
            } catch (method1Error) {
              console.log('⚠️ Method 1 failed:', method1Error);
            }

            // Method 2: Get from PushSubscription ID
            if (!playerId) {
              try {
                playerId = await oneSignalInstance.User.pushSubscription.id;
                console.log('🎯 Method 2 - PushSubscription ID:', playerId);
              } catch (method2Error) {
                console.log('⚠️ Method 2 failed:', method2Error);
              }
            }

            // Method 3: Get from User's external ID
            if (!playerId) {
              try {
                playerId = await oneSignalInstance.User.externalId;
                console.log('🎯 Method 3 - External ID:', playerId);
              } catch (method3Error) {
                console.log('⚠️ Method 3 failed:', method3Error);
              }
            }

            // Method 4: Get from User's email
            if (!playerId) {
              try {
                playerId = await oneSignalInstance.User.email;
                console.log('🎯 Method 4 - Email:', playerId);
              } catch (method4Error) {
                console.log('⚠️ Method 4 failed:', method4Error);
              }
            }

            if (playerId) {
              console.log('✅ Using OneSignal Player ID:', playerId);
              await saveSubscriptionId(playerId);
              return;
            } else {
              console.log('⚠️ All OneSignal methods failed to get Player ID');
              console.log('🔄 Falling back to IndexedDB method...');
            }
          } else {
            console.log('⚠️ Push notifications not supported');
          }
        } catch (oneSignalError) {
          console.log('❌ OneSignal direct method failed:', oneSignalError);
          console.log('🔄 Falling back to IndexedDB method...');
        }
      } else {
        console.log('⚠️ OneSignal not available, trying IndexedDB...');
      }

      // Fallback to IndexedDB method
      console.log('🗄️ Trying IndexedDB method...');
      const subscriptionId = await getSubscriptionIdFromIndexedDB();
      console.log('✅ Got Subscription ID from IndexedDB:', subscriptionId);
      await saveSubscriptionId(subscriptionId);
    } catch (e) {
      console.error('❌ Failed to get or save Subscription ID:', e);
      console.error('❌ Error details:', {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        name: e instanceof Error ? e.name : 'Unknown'
      });
      setNotifEnabled(false);
    }
  };

  const saveSubscriptionId = async (subscriptionId: string) => {
    if (!currentUser?.id) {
      console.error('❌ No current user found, cannot save subscription ID');
      return;
    }

    try {
      console.log('📦 Starting to save subscriptionId to backend...');
      console.log('👤 Current user ID:', currentUser.id);
      console.log('🔑 Subscription ID:', subscriptionId);
      console.log('🌐 Backend URL:', config.getBackendUrl());

      const requestBody = { playerId: subscriptionId, userId: currentUser.id };
      console.log('📤 Request body:', requestBody);

      const response = await apiCall(`${config.getBackendUrl()}/api/save-onesignal-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Subscription ID saved successfully to backend');
        console.log('📋 Response data:', responseData);
        setNotifEnabled(true);
      } else {
        const errorData = await response.text();
        console.error('❌ Failed to save Subscription ID:', response.status);
        console.error('❌ Error response:', errorData);
        setNotifEnabled(false);
      }
    } catch (error) {
      console.error('❌ Error saving Subscription ID:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      setNotifEnabled(false);
    }
  };

  // Add this function after saveSubscriptionId
  const requestNotificationPermission = async () => {
    if (!currentUser?.id) return;
    setPermissionRequested(true);
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission);
        if (permission === 'granted') {
          setShowPermissionPrompt(false);
          await getAndSaveSubscriptionId();
        } else {
          setShowPermissionPrompt(false);
        }
      }
    } catch (e) {
      setShowPermissionPrompt(false);
      setPermissionStatus('denied');
    }
  };

  // Push notification setup useEffect
  useEffect(() => {
    if (!currentUser?.id) return;

    const initializeNotifications = async () => {
      try {
        console.log('🚀 Starting notification initialization for user:', currentUser.id);

        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
          console.log('⚠️ Not in browser environment, skipping notification setup');
          return;
        }

        // Check notification permission first
        if ('Notification' in window) {
          const permission = Notification.permission;
          console.log('🔔 Current notification permission:', permission);

          if (permission === 'default') {
            console.log('🔔 Requesting notification permission...');
            const newPermission = await Notification.requestPermission();
            console.log('🔔 New permission status:', newPermission);

            if (newPermission !== 'granted') {
              console.log('⚠️ Notification permission denied');
              return;
            }
          } else if (permission === 'denied') {
            console.log('⚠️ Notification permission denied');
            return;
          }
        }

        // Initialize OneSignal
        const oneSignalInstance = await initializeOneSignal();

        if (oneSignalInstance) {
          console.log('✅ OneSignal initialized successfully');

          // Wait for OneSignal to be ready
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Try to get player ID
          try {
            const playerId = await oneSignalInstance.User.PushSubscription.id;
            console.log('🎯 OneSignal Player ID:', playerId);

            if (playerId) {
              console.log('✅ OneSignal ready with Player ID, saving to backend...');
              await saveSubscriptionId(playerId);
            } else {
              console.log('⚠️ OneSignal ready but no Player ID yet, trying IndexedDB...');
              await getAndSaveSubscriptionId();
            }
          } catch (idError) {
            console.log('⚠️ Could not get Player ID from OneSignal, trying IndexedDB...');
            await getAndSaveSubscriptionId();
          }
        } else {
          console.log('⚠️ OneSignal initialization failed, trying IndexedDB only...');
          await getAndSaveSubscriptionId();
        }
      } catch (error) {
        console.error('❌ Notification initialization failed:', error);
      }
    };

    // Delay initialization to ensure everything is loaded
    const timer = setTimeout(initializeNotifications, 2000);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);



  // App initialization useEffect
  useEffect(() => {
    const initializeApp = async () => {
      const user = getCurrentUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      // Check if session is still valid
      const isSessionValid = await checkSessionStatus()
      if (!isSessionValid) {
        console.log('Session invalid, redirecting to login...')
        handleAuthError()
        return
      }

      const currentUserData: CurrentUser = {
        id: user.id,
        username: user.username || "Unknown User",
        email: user.email || "",
        avatar: user.avatar || "/placeholder.svg?height=40&width=40",
        bio: "Hey there! I'm using this chat app.",
      }

      setCurrentUser(currentUserData)
      setEditedUser(currentUserData)

      // Connect to Socket.IO
      const socket = socketManager.connect()

      // Initialize WebRTC manager
      if (socket) {
        try {
          console.log('Initializing WebRTC manager...');

          // Check if we're in a browser environment
          if (typeof window === 'undefined') {
            console.log('Skipping WebRTC initialization on server side');
            return;
          }

          // Check if WebRTC is supported
          if (!navigator.mediaDevices) {
            console.error('MediaDevices API not supported in this browser');
            return;
          }

          const webrtc = new WebRTCManager(socket)
          setWebrtcManager(webrtc)

          // Listen for call state changes
          webrtc.onStateChange((state) => {
            console.log('Call state changed:', state);
            setCallState(state)
          })

          console.log('WebRTC manager initialized successfully');
        } catch (error) {
          console.error('Failed to initialize WebRTC manager:', error);
          // Don't throw the error, just log it and continue without WebRTC
        }
      } else {
        console.error('Socket not available for WebRTC initialization');
      }

      // Load contacts
      try {
        const response = await apiCall(`${config.getBackendUrl()}/api/contacts`)
        if (response.ok) {
          const contacts = await response.json()
          setUserContacts(contacts)
          if (contacts.length > 0 && !selectedContact) {
            const firstContact = contacts[0]
            setSelectedContact(firstContact)
            // Load messages for the first contact
            loadMessages(firstContact.id)
          }

        } else {
          console.error('Failed to load contacts')
        }
      } catch (error) {
        console.error('Error loading contacts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeApp()

    // Cleanup on unmount
    return () => {
      if (webrtcManager) {
        webrtcManager.endCall()
      }
      socketManager.disconnect()
    }
  }, [])

  // Periodic session check
  useEffect(() => {
    if (!currentUser) return;

    const sessionCheckInterval = setInterval(async () => {
      const isSessionValid = await checkSessionStatus();
      if (!isSessionValid) {
        console.log('Session expired during periodic check, redirecting to login...');
        handleAuthError();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(sessionCheckInterval);
  }, [currentUser]);

  // Local audio stream useEffect
  useEffect(() => {
    if (localAudioRef.current && callState.localStream) {
      localAudioRef.current.srcObject = callState.localStream
      localAudioRef.current.muted = true
      localAudioRef.current.volume = 0

      // Delay play to avoid AbortError
      setTimeout(() => {
        if (localAudioRef.current) {
          localAudioRef.current.play().catch(e => console.log('Local audio play failed:', e))
        }
      }, 500)
    }
  }, [callState.localStream])

  // Remote audio stream useEffect
  useEffect(() => {
    if (remoteAudioRef.current && callState.remoteStream) {
      remoteAudioRef.current.srcObject = callState.remoteStream
      remoteAudioRef.current.muted = false
      remoteAudioRef.current.volume = 1

      // Delay play to avoid AbortError
      setTimeout(() => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.play().catch(e => console.log('Remote audio play failed:', e))
        }
      }, 500)
    }
  }, [callState.remoteStream])

  // Typing indicator useEffect
  useEffect(() => {
    if (!selectedContact || !currentUser) return;
    let typingTimeout: NodeJS.Timeout;
    const handleTyping = () => {
      socketManager.sendTypingStart(selectedContact.id);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socketManager.sendTypingStop(selectedContact.id);
      }, 1500);
    };
    if (messageInputRef.current) {
      messageInputRef.current.addEventListener('input', handleTyping);
    }
    return () => {
      if (messageInputRef.current) {
        messageInputRef.current.removeEventListener('input', handleTyping);
      }
      clearTimeout(typingTimeout);
    };
  }, [selectedContact, currentUser]);

  // Request status useEffect
  useEffect(() => {
    if (selectedContact && socketManager.getSocket()) {
      socketManager.getSocket()?.emit('request_status', { userId: selectedContact.id });
    }
  }, [selectedContact]);

  // Socket event listeners useEffect
  useEffect(() => {
    if (!currentUser) return;
    socketManager.onUserTyping((data) => {
      if (selectedContact && data.userId === selectedContact.id) {
        setIsTyping(true);
      }
    });
    socketManager.onUserStoppedTyping((data) => {
      if (selectedContact && data.userId === selectedContact.id) {
        setIsTyping(false);
      }
    });
    // Listen for online/offline status
    if (socketManager.getSocket()) {
      socketManager.getSocket()?.on('user_status', (data) => {
        if (selectedContact && data.userId === selectedContact.id) {
          setContactStatus({ online: data.online, lastSeen: data.lastSeen });
        }
      });
    }

    // 🔥 NEW: Listen for read receipts
    socketManager.onMessagesReadByReceiver((data) => {
      console.log('📖 Messages read by receiver:', data);
      console.log('📖 Type of data.timestamp:', typeof data.timestamp, data.timestamp); // Debugging line

      // Ensure timestamp is a Date object before calling getTime()
      const timestampAsDate = typeof data.timestamp === 'string'
        ? new Date(data.timestamp)
        : data.timestamp;

      // Our messages were read by someone else
      // Update the read status for all messages sent to this receiver
      setMessages(prev => prev.map(msg => {
        if (msg.senderId === "me" && msg.receiverId === data.receiverId) {
          return { ...msg, isRead: true };
        }
        return msg;
      }));

      // Update the message read status state immediately
      setMessageReadStatus(prev => {
        console.log('📖 Updating messageReadStatus in onMessagesReadByReceiver');
        console.log('📖 Previous messageReadStatus:', prev);
        console.log('📖 Current messages:', messages);
        console.log('📖 Data received:', data);

        const newStatus = new Map(prev);
        // Find all messages sent by current user to this receiver and mark them as read
        let updatedCount = 0;
        messages.forEach(msg => {
          if (msg.senderId === "me" && msg.receiverId === data.receiverId) {
            newStatus.set(msg.id, true);
            updatedCount++;
            console.log(`📖 Marked message ${msg.id} as read`);
          }
        });

        console.log(`📖 Updated ${updatedCount} messages in messageReadStatus`);
        console.log('📖 New messageReadStatus:', newStatus);
        return newStatus;
      });

      // Store the timestamp of when our messages were read
      setLastReadReceipts(prev => {
        const newReceipts = new Map(prev);
        newReceipts.set(data.receiverId, timestampAsDate.getTime());
        return newReceipts;
      });
    });

    // 🔥 NEW: Listen for chat opened confirmation
    socketManager.onChatOpenedConfirmation((data) => {
      console.log('📖 Chat opened confirmation:', data);
      // Messages were successfully marked as read
    });

    // 🔥 NEW: Listen for chat opened errors
    socketManager.onChatOpenedError((error) => {
      console.error('📖 Chat opened error:', error);
      // Handle error if needed
    });

    return () => {
      socketManager.removeAllListeners();
      if (socketManager.getSocket()) {
        socketManager.getSocket()?.off('user_status');
      }
    };
  }, [selectedContact, currentUser]);

  // Message handling useEffect
  useEffect(() => {
    if (!currentUser) return;
    // Listen for new messages
    socketManager.onNewMessage((message) => {
      console.log('New message received:', message)

      // Add message to the current conversation if it matches
      if (selectedContact &&
        (message.senderId._id === selectedContact.id || message.receiverId._id === selectedContact.id)) {

        // Check if senderId is populated (object) or just an ID (string)
        const senderId = typeof message.senderId === 'object' ? message.senderId._id : message.senderId
        const isCurrentUser = senderId === currentUser.id

        console.log(`📝 New message ${message._id}:`, {
          senderId: senderId,
          currentUserId: currentUser.id,
          isCurrentUser: isCurrentUser,
          content: message.content
        })

        // Check if message contains URLs for link detection
        const urls = extractUrls(message.content);
        let messageType: "text" | "link" = message.type || "text";
        let linkMetadata: any = {};

        if (urls.length > 0 && messageType === "text") {
          messageType = "link";
          // Handle link detection asynchronously
          getLinkPreview(urls[0]).then(preview => {
            linkMetadata = {
              linkUrl: urls[0],
              linkTitle: preview.title,
              linkDescription: preview.description,
              linkImage: preview.image
            };

            const newMessage: Message = {
              id: message._id,
              senderId: isCurrentUser ? "me" : senderId,
              receiverId: isCurrentUser ? selectedContact.id : currentUser.id,
              content: message.content,
              timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
              type: messageType,
              fileName: message.fileName,
              fileSize: message.fileSize,
              isRead: false,
              // 🔥 NEW: Add link metadata if it's a link message
              ...linkMetadata
            }
            setMessages(prev => [...prev, newMessage])
          }).catch(error => {
            // Fallback to text if link processing fails
            console.error('Link preview failed:', error);
            const newMessage: Message = {
              id: message._id,
              senderId: isCurrentUser ? "me" : senderId,
              receiverId: isCurrentUser ? selectedContact.id : currentUser.id,
              content: message.content,
              timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
              type: "text",
              fileName: message.fileName,
              fileSize: message.fileSize,
              isRead: false
            }
            setMessages(prev => [...prev, newMessage])
          });
        } else {
          // No URLs found, create regular text message
          const newMessage: Message = {
            id: message._id,
            senderId: isCurrentUser ? "me" : senderId,
            receiverId: isCurrentUser ? selectedContact.id : currentUser.id,
            content: message.content,
            timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
            type: messageType,
            fileName: message.fileName,
            fileSize: message.fileSize,
            isRead: false
          }
          setMessages(prev => [...prev, newMessage])
        }

        // 🔥 If the chat is open and the message is from the selected contact, mark as read
        if (
          senderId === selectedContact.id &&
          document.visibilityState === 'visible'
        ) {
          console.log('📖 Chat is open and visible, re-emitting chat_opened for real-time read receipt');
          socketManager.sendChatOpened(selectedContact.id);
        }
      }

      // Update contact's last message
      setUserContacts(prev => prev.map(contact => {
        const senderId = typeof message.senderId === 'object' ? message.senderId._id : message.senderId
        if (contact.id === senderId) {
          return {
            ...contact,
            lastMessage: message.content,
            timestamp: "Just now",
            unread: contact.unread + 1
          }
        }
        return contact
      }))
    })

    // Listen for message sent confirmation
    socketManager.onMessageSent((message) => {
      console.log('Message sent successfully:', message)
    })

    // Listen for message errors
    socketManager.onMessageError((error) => {
      console.error('Message error:', error)
    })
    return () => {
      socketManager.removeAllListeners();
    };
  }, [currentUser, selectedContact]);

  // Load messages useEffect
  useEffect(() => {
    if (selectedContact && currentUser) {
      loadMessages(selectedContact.id)
    }
  }, [selectedContact?.id, currentUser?.id])

  // Friend search useEffect
  useEffect(() => {
    if (!friendSearchQuery.trim()) {
      setSearchedUsers([]);
      return;
    }
    setIsSearching(true);
    const url = `${config.getBackendUrl()}/api/auth/search?q=${encodeURIComponent(friendSearchQuery)}`;
    console.log('Searching users with URL:', url);

    const token = localStorage.getItem('user_token');
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(async res => {
        if (res.status === 401) {
          handleAuthError();
          return [];
        }
        if (!res.ok) {
          console.error('User search API error:', res.status, res.statusText);
          return [];
        }
        return res.json();
      })
      .then(users => {
        setSearchedUsers(
          users.filter((u: any) =>
            u._id !== currentUser?.id &&
            !userContacts.some(c => c.id === u._id)
          )
        );
      })
      .catch((err) => {
        console.error('User search fetch error:', err);
        setSearchedUsers([])
      })
      .finally(() => setIsSearching(false));
  }, [friendSearchQuery, currentUser, userContacts]);

  // Check notification status
  useEffect(() => {
    const checkNotificationStatus = async () => {
      if (!currentUser?.id) return;

      try {
        // Ensure OneSignal is loaded
        if (!OneSignal) {
          const module = await import('react-onesignal');
          OneSignal = module.default;
        }

        const isSubscribed = await OneSignal.Notifications.isPushSupported();
        setNotifEnabled(isSubscribed);
        console.log('Notification status checked:', isSubscribed);
      } catch (error) {
        console.error('Error checking notification status:', error);
      }
    };

    // Check status after a delay to ensure OneSignal is initialized
    const timer = setTimeout(checkNotificationStatus, 2000);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 User is online');
      setIsOnline(true);
      setConnectionStatus('connected');

      // 🔥 ENHANCED: Mark that user was offline and trigger reconnection
      if (wasOffline) {
        console.log('🔄 User was offline, triggering reconnection...');
        handleReconnection();
      }
    };

    const handleOffline = () => {
      console.log('📴 User is offline');
      setIsOnline(false);
      setConnectionStatus('disconnected');
      setLastSeen(Date.now());
      setWasOffline(true);
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setIsOnline(navigator.onLine);
    setConnectionStatus(navigator.onLine ? 'connected' : 'disconnected');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedContact, currentUser, wasOffline]); // 🔥 ADD wasOffline to dependencies

  // Track socket connection status
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    const handleConnect = () => {
      console.log('🔌 Socket connected');
      setConnectionStatus('connected');

      // 🔥 ENHANCED: If user was offline, trigger reconnection
      if (wasOffline) {
        console.log('🔌 Socket reconnected after being offline, triggering reconnection...');
        handleReconnection();
      }
    };

    const handleDisconnect = () => {
      console.log('🔌 Socket disconnected');
      setConnectionStatus('disconnected');
      setLastSeen(Date.now());
      setWasOffline(true);
    };

    const handleConnecting = () => {
      console.log('🔌 Socket connecting...');
      setConnectionStatus('connecting');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connecting', handleConnecting);

    // Set initial status
    setConnectionStatus(socket.connected ? 'connected' : 'disconnected');

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connecting', handleConnecting);
    };
  }, [socketManager, selectedContact, currentUser, wasOffline]); // 🔥 ADD wasOffline to dependencies

  // 🔥 NEW: Enhanced reconnection handling
  const handleReconnection = async () => {
    console.log('🔄 Handling reconnection...');

    if (selectedContact && currentUser) {
      try {
        console.log('📡 Fetching messages after reconnection...');
        await loadMessages(selectedContact.id);

        // 🔥 NEW: Request read receipts for messages sent while offline
        if (lastSeen && socketManager.isSocketConnected()) {
          console.log('📖 Requesting read receipts since offline...');
          socketManager.requestReadReceipts(lastSeen);
        }

        setWasOffline(false);
        setShowReconnectPopup(false);
      } catch (error) {
        console.error('❌ Failed to reload messages after reconnection:', error);
        // Show popup as fallback
        setShowReconnectPopup(true);
      }
    }
  };

  // 🔥 NEW: Update message read status when read receipts are received
  const updateMessageReadStatus = (messageId: string, isRead: boolean) => {
    setMessageReadStatus(prev => {
      const newStatus = new Map(prev);
      newStatus.set(messageId, isRead);
      return newStatus;
    });
  };

  // 🔥 NEW: Activity tracking
  const updateActivityTime = () => {
    setLastActivityTime(Date.now());
  };

  // 🔥 NEW: Check for inactivity and trigger reconnection
  const checkInactivityAndReconnect = () => {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    if (wasOffline && (now - lastActivityTime) > inactiveThreshold) {
      console.log('⏰ User returned from inactivity, triggering reconnection...');
      handleReconnection();
    }
  };

  // 🔥 NEW: Activity tracking useEffect
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      updateActivityTime();
      checkInactivityAndReconnect();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [wasOffline, lastActivityTime]); // Add dependencies

  // 🔥 NEW: Periodic reconnection check
  useEffect(() => {
    if (wasOffline) {
      const interval = setInterval(() => {
        checkInactivityAndReconnect();
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [wasOffline, lastActivityTime]);

  // Function to check if user should receive notifications (offline for more than 5 minutes)
  const shouldSendOfflineNotification = (lastSeenTime: number) => {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return lastSeenTime < fiveMinutesAgo;
  };

  // Function to get user's offline status message
  const getOfflineStatusMessage = (lastSeenTime: number) => {
    const now = Date.now();
    const diffInMinutes = Math.floor((now - lastSeenTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  // All other functions and logic below
  const handleTyping = () => {
    if (!selectedContact || !currentUser) return;
    socketManager.sendTypingStart(selectedContact.id);
    setTimeout(() => {
      socketManager.sendTypingStop(selectedContact.id);
    }, 1500);
  };

  const enableNotifications = async () => {
    if (!currentUser?.id) return;

    try {
      console.log('🔔 Requesting notification permission...');

      // Request permission using browser API
      const result = await Notification.requestPermission();
      console.log('🔔 Permission result:', result);

      if (result === 'granted') {
        // Initialize OneSignal
        const oneSignalInstance = await initializeOneSignal();

        if (oneSignalInstance) {
          console.log('✅ OneSignal initialized, triggering subscription...');

          // Show OneSignal subscription prompt
          try {
            await oneSignalInstance.showSlidedownPrompt();
            console.log('✅ OneSignal subscription prompt shown');

            // Wait for OneSignal to register
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Try to get and save subscription ID
            await getAndSaveSubscriptionId();
          } catch (promptError) {
            console.log('⚠️ OneSignal prompt failed, trying direct approach...');
            await getAndSaveSubscriptionId();
          }
        } else {
          console.log('⚠️ OneSignal not available, trying IndexedDB only...');
          await getAndSaveSubscriptionId();
        }
      } else {
        console.log('⚠️ Notification permission denied');
      }
    } catch (error) {
      console.error('❌ Error enabling notifications:', error);
    }
  };

  // Handle input focus for mobile
  const handleInputFocus = () => {
    setIsKeyboardVisible(true);
    // Add a small delay to ensure the keyboard animation completes
    setTimeout(() => {
      scrollToBottom();
    }, 300);
  }

  const handleInputBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // If send button was just clicked, don't close keyboard
    if (isSendButtonClickedRef.current) {
      return;
    }

    // Check if the related target (what we're clicking on) is the send button
    const relatedTarget = event.relatedTarget as HTMLElement;

    if (relatedTarget && sendButtonRef.current && sendButtonRef.current.contains(relatedTarget)) {
      // Don't close keyboard if clicking on send button
      return;
    }

    // For other blur events, let the viewport change handler determine keyboard state
    // This prevents keyboard from closing when clicking outside the input
  }

  // Handle viewport changes for mobile keyboard
  useEffect(() => {
    const handleViewportChange = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        const viewport = window.visualViewport;
        const isKeyboardOpen = viewport.height < window.innerHeight * 0.8; // More sensitive detection
        setIsKeyboardVisible(isKeyboardOpen);

        // If keyboard is open, scroll to bottom immediately
        if (isKeyboardOpen) {
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }
      }
    };

    // Handle resize events for older browsers
    const handleResize = () => {
      if (typeof window !== 'undefined' && !window.visualViewport) {
        const isKeyboardOpen = window.innerHeight < window.outerHeight * 0.8;
        setIsKeyboardVisible(isKeyboardOpen);

        if (isKeyboardOpen) {
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }
      }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleViewportChange);
        }
      };
    } else if (typeof window !== 'undefined') {
      // Fallback for browsers without visualViewport
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !currentUser) return;

    // Set flag to prevent blur
    isSendButtonClickedRef.current = true;

    // Immediately refocus the input to prevent blur
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }

    // Check if message contains URLs
    const urls = extractUrls(newMessage);
    let messageType: "text" | "link" = "text";
    let linkMetadata: any = {};

    if (urls.length > 0) {
      messageType = "link";
      try {
        const url = urls[0]; // Use the first URL found
        const preview = await getLinkPreview(url);
        linkMetadata = {
          linkUrl: url,
          linkTitle: preview.title,
          linkDescription: preview.description,
          linkImage: preview.image
        };
      } catch (error) {
        // Fallback to text if link processing fails
        messageType = "text";
      }
    }

    // Send message via Socket.IO
    socketManager.sendMessage(selectedContact.id, newMessage, messageType);

    // Add message to local state immediately for optimistic UI
    const message: Message = {
      id: Date.now().toString(),
      senderId: "me",
      receiverId: selectedContact.id,
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
      type: messageType,
      // 🔥 NEW: Set initial read status for new messages
      isRead: false,
      // 🔥 NEW: Add link metadata if it's a link message
      ...linkMetadata
    };

    setMessages(prev => [...prev, message]);

    // 🔥 NEW: Update message read status state
    setMessageReadStatus(prev => {
      const newStatus = new Map(prev);
      newStatus.set(message.id, false);
      return newStatus;
    });

    setNewMessage("");

    // Update contact's last message
    setUserContacts(prev => prev.map(contact => {
      if (contact.id === selectedContact.id) {
        return {
          ...contact,
          lastMessage: newMessage,
          timestamp: "Just now",
          unread: 0
        };
      }
      return contact;
    }));

    // Scroll to bottom immediately after sending
    setTimeout(() => {
      scrollToBottom();
    }, 50);

    // Reset flag and ensure input stays focused
    setTimeout(() => {
      isSendButtonClickedRef.current = false;
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }, 100);
  };

  const handleFileUpload = (type: "image" | "file") => {
    if (!selectedContact) return;

    const message: Message = {
      id: Date.now().toString(),
      senderId: "me",
      receiverId: selectedContact.id,
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
      type: type,
      fileName: type === "file" ? "document.pdf" : undefined,
      fileSize: type === "file" ? "2.4 MB" : undefined,
      isRead: false
    }

    setMessages([...messages, message])

    // 🔥 NEW: Update message read status state
    setMessageReadStatus(prev => {
      const newStatus = new Map(prev);
      newStatus.set(message.id, false);
      return newStatus;
    });
  }

  const handleAvatarUpload = () => {
    fileInputRef.current?.click()
  }

  // const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0]
  //   if (file && editedUser) {
  //     // In a real app, you would upload the file to a server
  //     // For now, we'll just create a local URL
  //     const imageUrl = URL.createObjectURL(file)
  //     setEditedUser({ ...editedUser, avatar: imageUrl })
  //   }
  // }

  const saveProfile = () => {
    setCurrentUser(editedUser)
    setIsEditingProfile(false)
  }

  const cancelEdit = () => {
    setEditedUser(currentUser)
    setIsEditingProfile(false)
  }

  const addFriend = async (user: ApiUser) => {
    try {
      const response = await apiCall(`${config.getBackendUrl()}/api/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contactId: user._id }),
      })

      if (response.ok) {
        const data = await response.json()
        const newContact: Contact = {
          id: user._id,
          name: user.username,
          avatar: "/placeholder.svg?height=40&width=40",
          lastMessage: "",
          timestamp: "Just now",
          online: false,
          unread: 0,
        }

        setUserContacts(prev => [...prev, newContact])
        setSearchedUsers(prev => prev.filter(u => u._id !== user._id))
        setFriendSearchQuery("")

        // Show success feedback
        console.log(`Added ${user.username} to contacts`)
      } else {
        const error = await response.json()
        console.error('Failed to add contact:', error.error)
      }
    } catch (error) {
      console.error('Error adding contact:', error)
    }
  }

  // Load messages for a contact
  const loadMessages = async (contactId: string, retryCount = 0) => {
    setIsLoadingMessages(true)
    setMessagesReady(false) // Reset message readiness
    setMessages([]) // Clear existing messages while loading

    try {
      const response = await apiCall(`${config.getBackendUrl()}/api/messages/${contactId}`)
      if (response.ok) {
        const messagesData = await response.json()
        console.log('📦 Raw messages data:', messagesData)
        console.log('👤 Current user ID:', currentUser?.id)

        // Only process messages if currentUser is available
        if (!currentUser) {
          console.error('Current user not available for message processing');
          setMessages([]);
          setMessagesReady(true);
          return;
        }

        const formattedMessages: Message[] = await Promise.all(messagesData.map(async (msg: any) => {
          // Check if senderId is populated (object) or just an ID (string)
          const senderId = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId
          const isCurrentUser = senderId === currentUser.id

          console.log(`📝 Message ${msg._id}:`, {
            senderId: senderId,
            currentUserId: currentUser.id,
            isCurrentUser: isCurrentUser,
            content: msg.content
          })

          // Check if message contains URLs for link detection
          const urls = extractUrls(msg.content);
          let messageType: "text" | "link" = msg.type || "text";
          let linkMetadata: any = {};

          if (urls.length > 0 && messageType === "text") {
            messageType = "link";
            try {
              const url = urls[0]; // Use the first URL found
              const preview = await getLinkPreview(url);
              linkMetadata = {
                linkUrl: url,
                linkTitle: preview.title,
                linkDescription: preview.description,
                linkImage: preview.image
              };
            } catch (error) {
              // Fallback to text if link processing fails
              messageType = "text";
            }
          }

          return {
            id: msg._id,
            senderId: isCurrentUser ? "me" : senderId,
            receiverId: isCurrentUser ? contactId : currentUser.id,
            content: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
            type: messageType,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            // 🔥 NEW: Include read status from backend
            isRead: msg.isRead || false,
            // 🔥 NEW: Add link metadata if it's a link message
            ...linkMetadata
          }
        }))

        console.log('✅ Formatted messages:', formattedMessages)
        setMessages(formattedMessages)

        // 🔥 NEW: Update message read status state
        const newMessageReadStatus = new Map<string, boolean>();
        formattedMessages.forEach(msg => {
          if (msg.senderId === "me") {
            newMessageReadStatus.set(msg.id, msg.isRead || false);
          }
        });
        setMessageReadStatus(newMessageReadStatus);

        setMessagesReady(true) // Mark messages as ready
      } else {
        console.error('Failed to load messages')
        setMessages([])
        setMessagesReady(true) // Mark as ready even if empty
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
      setMessagesReady(true) // Mark as ready even if error
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const deleteHistory = async () => {
    if (!selectedContact || !currentUser) return;
    try {
      // Call backend API to delete all messages between current user and selected contact
      const token = localStorage.getItem('user_token');
      await apiCall(`${config.getBackendUrl()}/api/messages/${selectedContact.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Failed to delete messages from database', err);
    }
    setMessages([]);
    setShowDeleteConfirm(false);
  }

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const filteredContacts = userContacts.filter((contact) => contact.name.toLowerCase().includes(searchQuery.toLowerCase()))

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior,
          block: 'end',
          inline: 'nearest'
        });
      }
      // Also scroll the scroll area to bottom for mobile
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100); // Small delay to ensure DOM is updated
  };

  // Handle scroll events to show/hide scroll to bottom button
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;

    // Check if user is at the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setIsAtBottom(isAtBottom);

    // Show scroll to bottom button if not at bottom
    setShowScrollToBottom(!isAtBottom);

    // Reset new message count if user scrolls to bottom
    if (isAtBottom) {
      setNewMessageCount(0);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      if (isAtBottom) {
        scrollToBottom();
      } else {
        // Increment new message count if user is not at bottom
        setNewMessageCount(prev => prev + 1);
      }
    }
  }, [messages, isAtBottom]);

  // Scroll to bottom when contact changes
  useEffect(() => {
    if (selectedContact) {
      setTimeout(() => {
        scrollToBottom('auto');
      }, 300);
    }
  }, [selectedContact?.id]);

  // Load messages when selected contact changes
  useEffect(() => {
    if (selectedContact && currentUser) {
      console.log('🔄 Loading messages for contact:', selectedContact.id)
      console.log('👤 Current user available:', currentUser.id)

      // Add a small delay to ensure currentUser is fully set
      const timer = setTimeout(() => {
        loadMessages(selectedContact.id)

        // 🔥 NEW: Send chat opened event to mark messages as read
        if (socketManager.isSocketConnected()) {
          console.log(`📖 Sending chat_opened event for contact: ${selectedContact.id}`);
          console.log(`📖 Current user ID: ${currentUser.id}`);
          console.log(`📖 Selected contact ID: ${selectedContact.id}`);
          console.log(`📖 Current messages loaded:`, messages);
          console.log(`📖 Message read status:`, messageReadStatus);
          console.log(`📖 Socket connection status:`, socketManager.getConnectionStatus());
          // When we open a chat with someone, we're telling the backend that we want to mark
          // all unread messages FROM that person TO us as read
          // The backend expects the senderId (the person whose messages we're reading)
          socketManager.sendChatOpened(selectedContact.id);
        } else {
          console.log(`❌ Socket not connected, cannot send chat_opened event`);
        }
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [selectedContact, currentUser])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages])

  // 🔥 NEW: Sync messageReadStatus with messages state
  useEffect(() => {
    console.log('🔄 Syncing messageReadStatus with messages state');
    console.log('📝 Current messages:', messages);
    console.log('📖 Current messageReadStatus:', messageReadStatus);

    const newMessageReadStatus = new Map<string, boolean>();
    messages.forEach(msg => {
      if (msg.senderId === "me") {
        newMessageReadStatus.set(msg.id, msg.isRead || false);
      }
    });

    console.log('📖 New messageReadStatus to be set:', newMessageReadStatus);
    setMessageReadStatus(newMessageReadStatus);
  }, [messages]);

  // Early return for loading state must come after all hooks
  if (isLoading || !currentUser) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Add Cloudinary upload function
  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'prayoshaChatApp');
    formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'deqab5u6x');
    // Use /image/upload for images, /raw/upload for everything else
    const isImage = file.type.startsWith('image/');
    const endpoint = isImage ? 'image' : 'raw';
    try {
      setIsUploadingImage(true);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'deqab5u6x'}/${endpoint}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setIsUploadingImage(false);
      return data.secure_url || null;
    } catch (err) {
      setIsUploadingImage(false);
      alert('File upload failed');
      return null;
    }
  };

  const handleImageButtonClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImageToCloudinary(file);
    if (url && selectedContact && currentUser) {
      // Send image message
      socketManager.sendMessage(selectedContact.id, url, "image");
      const message: Message = {
        id: Date.now().toString(),
        senderId: "me",
        receiverId: selectedContact.id,
        content: url,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
        type: "image",
        isRead: false
      };
      setMessages(prev => [...prev, message]);

      // 🔥 NEW: Update message read status state for image
      setMessageReadStatus(prev => {
        const newStatus = new Map(prev);
        newStatus.set(message.id, false);
        return newStatus;
      });

      setNewMessage("");
    }
  };

  // Add file upload handler
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImageToCloudinary(file); // Cloudinary supports files too
    if (url && selectedContact && currentUser) {
      socketManager.sendMessage(selectedContact.id, url, "file", file.name, (file.size / 1024 / 1024).toFixed(2) + ' MB');
      const message: Message = {
        id: Date.now().toString(),
        senderId: "me",
        receiverId: selectedContact.id,
        content: url,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
        type: "file",
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        isRead: false
      };
      setMessages(prev => [...prev, message]);

      // 🔥 NEW: Update message read status state for file
      setMessageReadStatus(prev => {
        const newStatus = new Map(prev);
        newStatus.set(message.id, false);
        return newStatus;
      });

      setNewMessage("");
    }
  };

  // Remove the old handleFileChange for avatar upload
  // Add a new function for avatar upload
  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && editedUser) {
      // In a real app, you would upload the file to a server
      // For now, we'll just create a local URL
      const imageUrl = URL.createObjectURL(file)
      setEditedUser({ ...editedUser, avatar: imageUrl })
    }
  }

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const forceOneSignalSubscription = async () => {
    console.log('🔧 Force triggering OneSignal subscription...');

    try {
      const oneSignalInstance = await initializeOneSignal();

      if (!oneSignalInstance) {
        console.error('❌ OneSignal not available for force subscription');
        return;
      }

      // Check if push is supported
      const isSupported = await oneSignalInstance.Notifications.isPushSupported();
      console.log('📱 Push supported:', isSupported);

      if (!isSupported) {
        console.error('❌ Push notifications not supported');
        return;
      }

      // Request permission explicitly
      console.log('🔔 Requesting notification permission...');
      const permission = await oneSignalInstance.Notifications.requestPermission();
      console.log('🔔 Permission result:', permission);

      if (permission === 'granted') {
        // Wait for OneSignal to process the subscription
        console.log('⏳ Waiting for OneSignal to create subscription...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Try to get the subscription ID again
        console.log('🔄 Attempting to get subscription ID after force subscription...');
        await getAndSaveSubscriptionId();
      } else {
        console.error('❌ Permission denied, cannot create subscription');
      }
    } catch (error) {
      console.error('❌ Error in force subscription:', error);
    }
  };

  const testPlayerIdRetrieval = async () => {
    if (!currentUser?.id) return;
    try {
      console.log('Testing playerId retrieval...');
      // Wait a bit to ensure OneSignal is fully initialized
      await new Promise(resolve => setTimeout(resolve, 2000));
      await getAndSaveSubscriptionId();
      console.log('PlayerId retrieval test completed.');
    } catch (error) {
      console.error('Error testing playerId retrieval:', error);
    }
  };

  const manuallySetPlayerId = async () => {
    if (!currentUser?.id) return;
    try {
      console.log('Manually setting playerId...');
      // Based on your OneSignal dashboard, the ID is: b8139c77-7c08-4cc5-9afc-2a0310041d2b
      const playerId = 'b8139c77-7c08-4cc5-9afc-2a0310041d2b';
      await saveSubscriptionId(playerId);
      setNotifEnabled(true);
      console.log('PlayerId manually set successfully:', playerId);
    } catch (error) {
      console.error('Error manually setting playerId:', error);
    }
  };

  const testNotification = async () => {
    if (!currentUser?.id) return;
    try {
      console.log('Testing notification...');
      const response = await apiCall(`${config.getBackendUrl()}/api/debug/test-notification/${currentUser.id}`);
      if (response.ok) {
        const result = await response.json();
        console.log('Test notification result:', result);
        alert('Test notification sent! Check your browser notifications.');
      } else {
        console.error('Test notification failed:', response.status);
      }
    } catch (error) {
      console.error('Error testing notification:', error);
    }
  };

  const checkNotificationStatus = async () => {
    if (!currentUser?.id) return;
    try {
      console.log('Checking notification status...');
      const response = await apiCall(`${config.getBackendUrl()}/api/debug/onesignal-config`);
      if (response.ok) {
        const config = await response.json();
        console.log('OneSignal config:', config);

        const userResponse = await apiCall(`${config.getBackendUrl()}/api/debug/validate-onesignal-user/${currentUser.id}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log('User OneSignal data:', userData);
        }
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  const testSubscriptionIdSaving = async () => {
    if (!currentUser?.id) {
      console.error('❌ No current user found');
      return;
    }

    console.log('🧪 Testing subscription ID saving...');
    console.log('👤 Current user:', currentUser);

    // Test with a dummy subscription ID first
    const testSubscriptionId = 'test-subscription-id-' + Date.now();
    console.log('🧪 Using test subscription ID:', testSubscriptionId);

    try {
      await saveSubscriptionId(testSubscriptionId);
      console.log('✅ Test subscription ID saved successfully');
    } catch (error) {
      console.error('❌ Test subscription ID saving failed:', error);
    }
  };

  const debugSubscriptionProcess = async () => {
    console.log('🔍 Starting subscription process debug...');
    console.log('👤 Current user:', currentUser);
    console.log('🔔 Notification permission:', Notification.permission);
    console.log('📱 OneSignal available:', !!OneSignal);

    if (OneSignal) {
      try {
        const isSupported = await OneSignal.Notifications.isPushSupported();
        console.log('📱 Push supported:', isSupported);

        if (isSupported) {
          const playerId = await OneSignal.User.PushSubscription.id;
          console.log('🎯 Current OneSignal Player ID:', playerId);
        }
      } catch (error) {
        console.error('❌ OneSignal debug error:', error);
      }
    }

    // Test IndexedDB
    try {
      const subscriptionId = await getSubscriptionIdFromIndexedDB();
      console.log('🗄️ IndexedDB subscription ID:', subscriptionId);
    } catch (error) {
      console.log('🗄️ IndexedDB error:', error);
    }
  };

  const initializeOneSignalSimple = async () => {
    console.log('🔄 Trying simple OneSignal initialization...');

    try {
      if (!OneSignal) {
        const module = await import('react-onesignal');
        OneSignal = module.default;
      }

      // Simple initialization with minimal options
      await OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '',
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' }
      });

      console.log('✅ Simple OneSignal initialization successful');

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to get player ID
      try {
        const playerId = await OneSignal.User.PushSubscription.id;
        console.log('🎯 Simple init - Player ID:', playerId);
        return playerId || null;
      } catch (idError) {
        console.log('⚠️ Simple init - No Player ID available yet');
        return null;
      }
    } catch (error) {
      console.error('❌ Simple OneSignal initialization failed:', error);
      return null;
    }
  };

  const initializeOneSignalProperly = async () => {
    console.log('🚀 Starting proper OneSignal initialization...');

    try {
      // First, ensure OneSignal is loaded properly
      if (!OneSignal) {
        console.log('📦 Loading OneSignal module...');
        try {
          const module = await import('react-onesignal');
          OneSignal = module.default;
          console.log('✅ OneSignal module loaded successfully');
        } catch (importError) {
          console.error('❌ Failed to import OneSignal module:', importError);
          return null;
        }
      }

      // Check if OneSignal is already initialized
      try {
        const isInitialized = await OneSignal.Notifications.isPushSupported();
        if (isInitialized) {
          console.log('✅ OneSignal already initialized');
          const playerId = await OneSignal.User.PushSubscription.id;
          return playerId || null;
        }
      } catch (checkError) {
        console.log('OneSignal not yet initialized, proceeding with init...');
      }

      console.log('🔧 Initializing OneSignal with proper configuration...');

      // Wait a bit before initialization to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      await OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '',
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' },
        notifyButton: {
          enable: false,
        },
        welcomeNotification: {
          disable: true,
        },
        // Simplified configuration to avoid initialization issues
        autoRegister: false,
        autoResubscribe: false,
        persistNotification: false
      });

      console.log('✅ OneSignal initialized successfully');

      // Wait for OneSignal to fully set up
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if push is supported
      try {
        const isSupported = await OneSignal.Notifications.isPushSupported();
        console.log('📱 Push notifications supported:', isSupported);

        if (isSupported) {
          // Request permission if not already granted
          const permission = await OneSignal.Notifications.permission;
          console.log('🔔 Current permission:', permission);

          if (permission === 'default') {
            console.log('🔔 Requesting notification permission...');
            await OneSignal.Notifications.requestPermission();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // Get the player ID
          const playerId = await OneSignal.User.PushSubscription.id;
          console.log('🎯 OneSignal Player ID:', playerId);

          if (playerId) {
            console.log('✅ OneSignal properly initialized with Player ID');
            return playerId;
          } else {
            console.log('⚠️ OneSignal initialized but no Player ID yet');
          }
        } else {
          console.log('⚠️ Push notifications not supported');
        }
      } catch (apiError) {
        console.error('❌ Error accessing OneSignal API:', apiError);
      }

      return null;
    } catch (error) {
      console.error('❌ OneSignal initialization failed:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });

      // Try simple initialization as fallback
      console.log('🔄 Trying simple initialization as fallback...');
      return await initializeOneSignalSimple();
    }
  };



  const checkOneSignalEnvironment = () => {
    console.log('🔍 Checking OneSignal environment configuration...');

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    const hasAppId = !!appId;

    console.log('📋 Environment check results:');
    console.log('  - NEXT_PUBLIC_ONESIGNAL_APP_ID:', hasAppId ? '✅ Set' : '❌ Not set');
    console.log('  - App ID value:', appId || 'undefined');
    console.log('  - App ID length:', appId?.length || 0);
    console.log('  - Is valid format:', appId?.length === 36 ? '✅ Yes' : '❌ No');

    if (!hasAppId) {
      console.error('❌ NEXT_PUBLIC_ONESIGNAL_APP_ID is not set in environment variables');
      alert('OneSignal App ID is not configured. Please check your .env.local file.');
      return false;
    }

    if (appId.length !== 36) {
      console.error('❌ OneSignal App ID format is invalid (should be 36 characters)');
      alert('OneSignal App ID format is invalid. Please check your configuration.');
      return false;
    }

    console.log('✅ OneSignal environment configuration is valid');
    return true;
  };

  const testOneSignalInitialization = async () => {
    console.log('🧪 Testing OneSignal initialization...');

    try {
      // Test basic initialization
      const oneSignalInstance = await initializeOneSignal();

      if (oneSignalInstance) {
        console.log('✅ OneSignal initialization test passed');

        // Test getting player ID
        try {
          const playerId = await oneSignalInstance.User.PushSubscription.id;
          console.log('🎯 Player ID test result:', playerId);

          if (playerId) {
            console.log('✅ Player ID retrieval test passed');
            return { success: true, playerId };
          } else {
            console.log('⚠️ Player ID is null/undefined');
            return { success: false, error: 'No Player ID available' };
          }
        } catch (idError) {
          console.log('❌ Player ID retrieval test failed:', idError);
          return { success: false, error: idError instanceof Error ? idError.message : String(idError) };
        }
      } else {
        console.log('❌ OneSignal initialization test failed');
        return { success: false, error: 'OneSignal initialization failed' };
      }
    } catch (error) {
      console.error('❌ OneSignal test error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };

  const testOfflineNotificationSystem = async () => {
    console.log('🧪 Testing offline notification system...');

    if (!currentUser?.id) {
      console.log('❌ No current user for offline test');
      return;
    }

    try {
      // Test the backend notification endpoint
      const response = await apiCall(`${config.getBackendUrl()}/api/debug/test-notification/${currentUser.id}`);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Offline notification test result:', result);
        alert('Test notification sent! Check your browser notifications.');
        return { success: true, result };
      } else {
        const error = await response.text();
        console.error('❌ Offline notification test failed:', error);
        return { success: false, error };
      }
    } catch (error) {
      console.error('❌ Offline notification test error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };

  const manuallyTriggerOneSignalSubscription = async () => {
    console.log('🔔 Manually triggering OneSignal subscription...');

    try {
      // Initialize OneSignal
      const oneSignalInstance = await initializeOneSignal();

      if (oneSignalInstance) {
        console.log('✅ OneSignal initialized, showing subscription prompt...');

        // Show the subscription prompt
        await oneSignalInstance.showSlidedownPrompt();
        console.log('✅ Subscription prompt shown');

        // Wait for user interaction and OneSignal to process
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Try to get the Player ID after subscription
        try {
          const playerId = await oneSignalInstance.User.PushSubscription.id;
          console.log('🎯 Player ID after subscription:', playerId);

          if (playerId) {
            console.log('✅ Successfully got Player ID, saving to backend...');
            await saveSubscriptionId(playerId);
            alert('OneSignal subscription successful! Player ID: ' + playerId);
          } else {
            console.log('⚠️ Still no Player ID after subscription');
            alert('Subscription prompt shown but no Player ID generated yet. Please try again.');
          }
        } catch (idError) {
          console.error('❌ Error getting Player ID after subscription:', idError);
          alert('Subscription prompt shown but could not get Player ID. Please try again.');
        }
      } else {
        console.error('❌ Could not initialize OneSignal');
        alert('Could not initialize OneSignal. Please check your configuration.');
      }
    } catch (error) {
      console.error('❌ Error triggering OneSignal subscription:', error);
      alert('Error triggering OneSignal subscription: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Add this function after forceOneSignalSubscription
  const showNotificationSettingsGuide = () => {
    const guide = `
🔔 **Notification Display Settings**

**To get floating/heads-up notifications like WhatsApp:**

**Chrome/Edge:**
1. Go to Settings → Privacy and Security → Site Settings → Notifications
2. Find your site and click "Edit"
3. Change from "Show notifications" to "Show notifications (including sound)"
4. Enable "Show notifications even when the site is closed"

**Firefox:**
1. Go to Settings → Privacy & Security → Permissions → Notifications
2. Click "Settings" next to your site
3. Select "Allow" and check "Show notifications even when Firefox is closed"

**Mobile Chrome:**
1. Go to Settings → Site Settings → Notifications
2. Find your site and enable "Show notifications"
3. In Android Settings → Apps → Chrome → Notifications
4. Enable "Show notifications" and "Allow notification dot"

**Note:** Floating notifications are controlled by your device's notification settings, not the website.
    `;

    alert(guide);
  };

  // Add this function after loadMessages
  const debugMessageSenders = () => {
    console.log('🔍 Debugging message senders...')
    console.log('👤 Current user:', currentUser)
    console.log('📱 Selected contact:', selectedContact)
    console.log('💬 Current messages:', messages)

    messages.forEach((msg, index) => {
      console.log(`📝 Message ${index + 1}:`, {
        id: msg.id,
        senderId: msg.senderId,
        content: msg.content,
        isFromMe: msg.senderId === "me",
        shouldBeRight: msg.senderId === "me"
      })
    })
  }

  const testCallFunctionality = async () => {
    console.log('🧪 Testing call functionality...');

    if (!webrtcManager) {
      console.error('❌ WebRTC manager not initialized');
      alert('WebRTC manager not initialized. Please refresh the page.');
      return;
    }

    if (!selectedContact) {
      console.error('❌ No contact selected');
      alert('Please select a contact first.');
      return;
    }

    if (!socketManager.isSocketConnected()) {
      console.error('❌ Socket not connected');
      alert('Not connected to server. Please check your connection.');
      return;
    }

    console.log('✅ All prerequisites met, testing device access...');

    try {
      // Test device permissions
      const permissions = await webrtcManager.checkDevicePermissions();
      console.log('📱 Device permissions:', permissions);

      if (!permissions.audio) {
        alert('Microphone access required for calls. Please allow microphone access.');
        return;
      }

      // Test actual device access
      console.log('🔍 Testing actual device access...');
      const audioAccess = await webrtcManager.testDeviceAccess(true, false);
      console.log('🎤 Audio access test result:', audioAccess);

      if (!audioAccess) {
        alert('Failed to access microphone. Please check device permissions and try again.');
        return;
      }

      // Test WebRTC connection
      console.log('🌐 Testing WebRTC connection...');
      const connectionTest = await webrtcManager.testConnection();
      console.log('🌐 WebRTC connection test result:', connectionTest);

      // Get diagnostics
      const diagnostics = webrtcManager.getConnectionDiagnostics();
      console.log('🔧 WebRTC diagnostics:', diagnostics);

      console.log('✅ All tests passed, ready for calls');
      alert('Call functionality is ready! You can now make voice or video calls.\n\nDiagnostics:\n' + JSON.stringify(diagnostics, null, 2));

    } catch (error) {
      console.error('❌ Error testing call functionality:', error);
      alert('Error testing call functionality: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  const testSocketConnection = () => {
    console.log('🧪 Testing socket connection...');

    const socket = socketManager.getSocket();
    if (!socket) {
      alert('Socket not available');
      return;
    }

    console.log('Socket connection status:', {
      connected: socket.connected,
      id: socket.id
    });

    // Test sending a simple event
    socket.emit('test_event', { message: 'Test from client' });

    alert(`Socket Status:\nConnected: ${socket.connected ? 'Yes' : 'No'}\nID: ${socket.id || 'None'}`);
  }

  const debugCallError = async () => {
    console.log('🔍 Debugging call error...');

    const debugInfo = {
      webrtcManager: !!webrtcManager,
      socket: !!socketManager.getSocket(),
      socketConnected: socketManager.isSocketConnected(),
      selectedContact: selectedContact?.id,
      callState: callState,
      userAgent: navigator.userAgent,
      webRTCSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      permissions: null as any
    };

    try {
      // Test permissions
      if (webrtcManager) {
        debugInfo.permissions = await webrtcManager.checkDevicePermissions();
      }
    } catch (error) {
      debugInfo.permissions = { error: error instanceof Error ? error.message : String(error) };
    }

    console.log('🔍 Call Debug Info:', debugInfo);

    const debugMessage = `Call Debug Information:
    
WebRTC Manager: ${debugInfo.webrtcManager ? '✅ Initialized' : '❌ Not initialized'}
Socket Available: ${debugInfo.socket ? '✅ Yes' : '❌ No'}
Socket Connected: ${debugInfo.socketConnected ? '✅ Yes' : '❌ No'}
Contact Selected: ${debugInfo.selectedContact ? '✅ ' + debugInfo.selectedContact : '❌ No'}
WebRTC Supported: ${debugInfo.webRTCSupported ? '✅ Yes' : '❌ No'}
Browser: ${debugInfo.userAgent}

Call State:
- Incoming: ${callState.isIncoming}
- Outgoing: ${callState.isOutgoing}
- Connected: ${callState.isConnected}
- Local Stream: ${callState.localStream ? '✅ Available' : '❌ None'}
- Remote Stream: ${callState.remoteStream ? '✅ Available' : '❌ None'}

Permissions: ${debugInfo.permissions ? JSON.stringify(debugInfo.permissions, null, 2) : 'Not tested'}`;

    alert(debugMessage);
  }

  const testVideoCallControls = () => {
    console.log('=== Testing Video Call Controls ===');
    if (!webrtcManager) {
      console.error('WebRTC Manager not available');
      alert('WebRTC Manager not available for testing');
      return;
    }

    console.log('Testing mute toggle...');
    webrtcManager.toggleMute();

    console.log('Testing video toggle...');
    webrtcManager.toggleVideo();

    console.log('Testing end call...');
    webrtcManager.endCall();

    alert('Video call controls tested. Check console for logs.');
  }

  // 🔥 NEW: Reconnection popup component
  const ReconnectionPopup = () => {
    if (!showReconnectPopup) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
          <div className="mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Restored</h3>
            <p className="text-gray-600 mb-4">
              You were offline. Some messages might not be visible. Would you like to refresh to see all messages?
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowReconnectPopup(false);
                handleReconnection();
              }}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh Messages
            </button>
            <button
              onClick={() => {
                setShowReconnectPopup(false);
                window.location.reload();
              }}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 relative overflow-hidden">
      {/* Mobile-specific meta viewport styles */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-safe-area {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .mobile-input-focus {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 9999;
          }
          .mobile-header-visible {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 9999 !important;
            border-bottom: none !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
          }
          .mobile-keyboard-open {
            padding-bottom: 120px !important;
          }
          .mobile-messages-container {
            height: calc(100vh - 120px) !important;
          }
        }
      `}</style>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-5 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar - Telegram Style */}
      <div
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out relative border-r-0",
          isSidebarOpen
            ? "w-80 fixed md:relative inset-y-0 left-0 md:left-auto z-10"
            : "w-0 md:w-12 overflow-hidden z-20 md:z-auto"
        )}
        style={{
          backgroundColor: '#54a9eb'
        }}
      >
        {/* Sidebar Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "absolute top-4 z-30 transition-all duration-300 rounded-full h-8 w-8 p-0",
            isSidebarOpen
              ? "right-4 hover:bg-gray-100"
              : "right-2 md:right-1 bg-blue-500 text-white hover:bg-blue-600 shadow-lg",
          )}
        >
          {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        {/* Sidebar Content */}
        <div
          className={cn(
            "transition-all duration-300 h-full",
            isSidebarOpen ? "opacity-100 z-10" : "opacity-0 md:opacity-100",
          )}
        >
          {isSidebarOpen ? (
            <>
              {/* Telegram-style Header */}
              <div
                className="p-4 text-white pt-16"
                style={{ backgroundColor: '#54a9eb' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 border-2 border-white/20">
                      <AvatarImage src={currentUser.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-white/20 text-white">
                        {currentUser.username
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-lg font-medium">{currentUser.username}</h1>
                      <p className="text-xs text-blue-100">online</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white hover:bg-white/10 p-2"
                        >
                          <UserPlus className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add New Contact</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                              placeholder="Search people..."
                              value={friendSearchQuery}
                              onChange={(e) => setFriendSearchQuery(e.target.value)}
                              className="pl-10 border-gray-200 focus:border-blue-500"
                            />
                          </div>

                          {/* Search Results */}
                          {friendSearchQuery.trim() && (
                            <div>
                              <h3 className="text-sm font-medium text-gray-700 mb-2">Search Results</h3>
                              {isSearching ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  <span className="text-sm text-gray-500">Searching...</span>
                                </div>
                              ) : searchedUsers.length > 0 ? (
                                <div className="space-y-2">
                                  {searchedUsers.map((user) => (
                                    <div key={user._id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                                      <div className="flex items-center space-x-3">
                                        <Avatar className="h-10 w-10">
                                          <AvatarImage src="/placeholder.svg" />
                                          <AvatarFallback className="bg-blue-100 text-blue-600">
                                            {user.username
                                              .split(" ")
                                              .map((n) => n[0])
                                              .join("")}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <p className="text-sm font-medium">{user.username}</p>
                                          <p className="text-xs text-gray-500">{user.email}</p>
                                        </div>
                                      </div>
                                      <Button size="sm" className="bg-blue-500 hover:bg-blue-600" onClick={() => addFriend(user)}>
                                        <UserPlus className="h-3 w-3 mr-1" />
                                        Add
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-sm text-gray-500">No users found</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 p-2">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                          <User className="h-4 w-4 mr-2" />
                          My Profile
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-black placeholder-white/60 focus:bg-white/20 focus:border-white/40"
                  />
                </div>
              </div>

              {/* Contacts List - Telegram Style */}
              <ScrollArea className="flex-1 bg-white">
                <div className="p-0">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => {
                        setSelectedContact(contact)
                      }}
                      className={cn(
                        "flex items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100",
                        selectedContact?.id === contact.id && "bg-blue-50"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={contact.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-gray-200 text-gray-600">
                            {contact.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        {contact.online && (
                          <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                          <p className="text-xs text-gray-500 contact-timestamp">{contact.timestamp}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500 contact-last-message">{contact.lastMessage}</p>
                          {contact.unread > 0 && (
                            <div className="ml-2 h-5 w-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                              {contact.unread > 9 ? '9+' : contact.unread}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            // Collapsed sidebar
            <div className="hidden md:flex flex-col items-center py-4 space-y-4 pt-16">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSidebarOpen(true)
                  setIsAddFriendOpen(true)
                }}
                className="p-2 rounded-full hover:bg-gray-100"
                title="Add Friends"
              >
                <UserPlus className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2 rounded-full hover:bg-gray-100" title="Menu">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right">
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                    <User className="h-4 w-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area - Telegram Style */}
      <div
        ref={chatContainerRef}
        className={cn(
          "flex-1 flex flex-col bg-gray-50 relative",
          isSidebarOpen ? "z-0" : "z-10"
        )}
        style={{
          height: isKeyboardVisible && typeof window !== "undefined" && window.visualViewport
            ? `${window.visualViewport?.height || window.innerHeight}px`
            : "100vh",
          minHeight: "100vh",
          maxHeight: "100vh",
        }}
      >
        {/* Telegram-style Header - Always Visible (Updated) */}
        <div
          className={cn(
            "text-white shadow-lg z-50 mobile-header-visible",
            isKeyboardVisible ? "fixed top-0 left-0 right-0" : "sticky top-0"
          )}
          style={{
            position: isKeyboardVisible ? 'fixed' : 'sticky',
            top: '0',
            left: isSidebarOpen && !isKeyboardVisible ? '320px' : '0',
            right: '0',
            zIndex: 9999,
            transition: 'left 0.3s ease',
            backgroundColor: '#54a9eb'
          }}
        >
          {selectedContact ? (
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="p-2 rounded-full hover:bg-white/10 text-white md:hidden"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-10 w-10 border-2 border-white/20">
                  <AvatarImage src={selectedContact?.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-white/20 text-white">
                    {selectedContact?.name
                      ? selectedContact.name.split(" ").map((n) => n[0]).join("")
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-white">{selectedContact?.name || "No Contact"}</h3>
                  <p className="text-xs text-blue-100">
                    {contactStatus.online
                      ? "online"
                      : contactStatus.lastSeen
                        ? `last seen ${getOfflineStatusMessage(contactStatus.lastSeen)}`
                        : "offline"}
                  </p>

                </div>
              </div>
              <div className="flex items-center space-x-1">
                {/* Voice Call Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 rounded-full hover:bg-white/10 text-white"
                  onClick={async () => {
                    try {
                      if (webrtcManager && selectedContact) {
                        console.log('Starting voice call with:', selectedContact.id);
                        const success = await webrtcManager.startVoiceCall(selectedContact.id);
                        if (!success) {
                          console.error('Failed to start voice call');
                          alert('Failed to start voice call. Please check your microphone permissions and try again.');
                        } else {
                          console.log('Voice call initiated successfully');
                        }
                      } else {
                        console.error('WebRTC manager or selected contact not available');
                        alert('Unable to start call. Please refresh the page and try again.');
                      }
                    } catch (error) {
                      console.error('Error in voice call handler:', error);
                      alert('Voice call error: ' + (error instanceof Error ? error.message : String(error)));
                    }
                  }}
                  disabled={!webrtcManager || !selectedContact || callState.isIncoming || callState.isOutgoing || callState.isConnected}
                  title={!webrtcManager ? "WebRTC not initialized" : !selectedContact ? "No contact selected" : "Start voice call"}
                >
                  <Phone className="h-5 w-5" />
                </Button>

                {/* Video Call Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 rounded-full hover:bg-white/10 text-white"
                  onClick={async () => {
                    try {
                      if (webrtcManager && selectedContact) {
                        console.log('Starting video call with:', selectedContact.id);
                        const success = await webrtcManager.startVideoCall(selectedContact.id);
                        if (!success) {
                          console.error('Failed to start video call');
                          alert('Failed to start video call. Please check your camera and microphone permissions and try again.');
                        } else {
                          console.log('Video call initiated successfully');
                        }
                      } else {
                        console.error('WebRTC manager or selected contact not available');
                        alert('Unable to start call. Please refresh the page and try again.');
                      }
                    } catch (error) {
                      console.error('Error in video call handler:', error);
                      alert('Video call error: ' + (error instanceof Error ? error.message : String(error)));
                    }
                  }}
                  disabled={!webrtcManager || !selectedContact || callState.isIncoming || callState.isOutgoing || callState.isConnected}
                  title={!webrtcManager ? "WebRTC not initialized" : !selectedContact ? "No contact selected" : "Start video call"}
                >
                  <Video className="h-5 w-5" />
                </Button>

                {/* More Options Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-2 rounded-full hover:bg-white/10 text-white">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>

                    <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete History
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            <div className="p-4 flex items-center justify-center">
              <div className="text-center">
                <h3 className="font-medium text-white">Select a chat</h3>
                <p className="text-xs text-blue-100 mt-1">Choose from your existing conversations</p>
              </div>
            </div>
          )}
        </div>

        {/* Messages Area - Telegram Style */}
        <div
          className="flex-1 overflow-hidden relative"
          style={{
            marginTop: '64px', // Always account for header height
            paddingBottom: isKeyboardVisible ? '120px' : '0', // Add padding when keyboard is visible
          }}
        >
          <ScrollArea
            ref={scrollAreaRef}
            className={cn(
              "h-full p-0",
              isKeyboardVisible && "mobile-messages-container"
            )}
            onScroll={handleScroll}
          >
            <div className={cn(
              "p-4 space-y-3",
              isKeyboardVisible && "pb-20"
            )}>
              {isLoadingMessages || !messagesReady ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-500" />
                  <span className="text-sm text-gray-500">
                    {isLoadingMessages ? "Loading messages..." : "Organizing messages..."}
                  </span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="h-10 w-10 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Say hello to {selectedContact?.name || 'your contact'} and start your conversation!
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  // <div
                  //   key={message.id}
                  //   className={cn("flex mb-2", message.senderId === "me" ? "justify-end" : "justify-start")}
                  // >
                  //   <div
                  //     className={cn(
                  //       "chat-message-bubble px-3 py-2 rounded-2xl shadow-sm relative",
                  //       message.senderId === "me"
                  //         ? "bg-blue-500 text-white rounded-br-md"
                  //         : "bg-white text-gray-900 rounded-bl-md border border-gray-200"
                  //     )}
                  //   >
                  //     {message.type === "text" && (
                  //       <div className="relative">
                  //         <p className="chat-message-text text-sm pr-12">{message.content}</p>
                  //         <div className="flex items-center justify-end space-x-1 mt-1">
                  //           <span className="chat-message-timestamp text-xs">
                  //             {message.timestamp}
                  //           </span>
                  //           {/* 🔥 NEW: Read receipts with ticks */}
                  //           {message.senderId === "me" && (
                  //             <div className="flex items-center ml-1">
                  //               {messageReadStatus.get(message.id) ? (
                  //                 // ⚫ Two black ticks = read
                  //                 <div className="flex space-x-0.5">
                  //                   <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                   </svg>
                  //                   <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                   </svg>
                  //                 </div>
                  //               ) : (
                  //                 // ⚫ One black tick = sent but not read
                  //                 <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                   <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                 </svg>
                  //               )}
                  //             </div>
                  //           )}
                  //         </div>
                  //       </div>
                  //     )}
                  //     {message.type === "image" && message.content && (
                  //       <div className="space-y-2">
                  //         <img
                  //           src={message.content}
                  //           alt="Shared image"
                  //           className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                  //           style={{ maxWidth: 240, maxHeight: 320 }}
                  //           onClick={() => setPreviewImage(message.content)}
                  //         />
                  //         <div className="flex items-center justify-end space-x-1">
                  //           <span className="chat-message-timestamp text-xs">
                  //             {message.timestamp}
                  //           </span>
                  //           {/* 🔥 NEW: Read receipts with ticks for images */}
                  //           {message.senderId === "me" && (
                  //             <div className="flex items-center ml-1">
                  //               {messageReadStatus.get(message.id) ? (
                  //                 // ⚫ Two black ticks = read
                  //                 <div className="flex space-x-0.5">
                  //                   <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                   </svg>
                  //                   <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                   </svg>
                  //                 </div>
                  //               ) : (
                  //                 // ⚫ One black tick = sent but not read
                  //                 <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                   <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                 </svg>
                  //               )}
                  //             </div>
                  //           )}
                  //         </div>
                  //       </div>
                  //     )}
                  //     {message.type === "file" && message.content && (
                  //       <div className="space-y-2">
                  //         <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  //           <File className="h-6 w-6 text-blue-500 flex-shrink-0" />
                  //           <div className="min-w-0 flex-1">
                  //             <a
                  //               href={message.content}
                  //               target="_blank"
                  //               rel="noopener noreferrer"
                  //               className="text-sm font-medium underline hover:no-underline block truncate"
                  //             >
                  //               {message.fileName || 'Download file'}
                  //             </a>
                  //             <p className="text-xs text-gray-500 mt-1">{message.fileSize}</p>
                  //           </div>
                  //         </div>
                  //         <div className="flex items-center justify-end space-x-1">
                  //           <span className="chat-message-timestamp text-xs">
                  //             {message.timestamp}
                  //           </span>
                  //           {/* 🔥 NEW: Read receipts with ticks for files */}
                  //           {message.senderId === "me" && (
                  //             <div className="flex items-center ml-1">
                  //               {messageReadStatus.get(message.id) ? (
                  //                 // ⚫ Two black ticks = read
                  //                 <div className="flex space-x-0.5">
                  //                   <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                   </svg>
                  //                   <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                   </svg>
                  //                 </div>
                  //               ) : (
                  //                 // ⚫ One black tick = sent but not read
                  //                 <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  //                   <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  //                 </svg>
                  //               )}
                  //             </div>
                  //           )}
                  //         </div>
                  //       </div>
                  //     )}
                  //   </div>
                  // </div>
                  <div
                    key={message.id}
                    className={cn("flex mb-2", message.senderId === "me" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "chat-message-bubble px-3 py-2 rounded-2xl shadow-sm relative max-w-xs",
                        message.senderId === "me"
                          ? "bg-blue-500 text-white rounded-br-md"
                          : "bg-white text-gray-900 rounded-bl-md border border-gray-200"
                      )}
                    >
                      {message.type === "text" && (
                        <div className="relative pb-4">
                          <p className="text-sm pr-14">{message.content}</p>
                          <div className="absolute bottom-0 right-0 flex items-center space-x-1">
                            <span className={cn(
                              "text-xs",
                              message.senderId === "me" ? "text-white/70" : "text-gray-500"
                            )}>
                              {message.timestamp}
                            </span>
                            {message.senderId === "me" && (
                              <div className="flex items-center">
                                {messageReadStatus.get(message.id) ? (
                                  <div className="flex space-x-0.5">
                                    <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                ) : (
                                  <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {message.type === "link" && (
                        <div className="relative pb-4">
                          <div className="space-y-2">
                            <p className="text-sm pr-14">{message.content}</p>
                            {message.linkUrl && (
                              <div className={cn(
                                "rounded-lg p-3 border",
                                message.senderId === "me" 
                                  ? "bg-white/10 border-white/20" 
                                  : "bg-gray-50 border-gray-200"
                              )}>
                                <a
                                  href={message.linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "block rounded transition-colors",
                                    message.senderId === "me" 
                                      ? "hover:bg-white/5" 
                                      : "hover:bg-gray-100"
                                  )}
                                >
                                  <div className="flex items-start space-x-3">
                                    {message.linkImage && (
                                      <img
                                        src={message.linkImage}
                                        alt="Link preview"
                                        className="w-16 h-16 object-cover rounded flex-shrink-0"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <h4 className={cn(
                                        "text-sm font-medium truncate",
                                        message.senderId === "me" ? "text-white" : "text-gray-900"
                                      )}>
                                        {message.linkTitle || 'Link'}
                                      </h4>
                                      <p className={cn(
                                        "text-xs mt-1 line-clamp-2",
                                        message.senderId === "me" ? "text-white/70" : "text-gray-600"
                                      )}>
                                        {message.linkDescription || message.linkUrl}
                                      </p>
                                      <div className="flex items-center mt-2">
                                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                                        <span className={cn(
                                          "text-xs",
                                          message.senderId === "me" ? "text-white/60" : "text-gray-500"
                                        )}>
                                          {new URL(message.linkUrl).hostname}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-0 right-0 flex items-center space-x-1">
                            <span className={cn(
                              "text-xs",
                              message.senderId === "me" ? "text-white/70" : "text-gray-500"
                            )}>
                              {message.timestamp}
                            </span>
                            {message.senderId === "me" && (
                              <div className="flex items-center">
                                {messageReadStatus.get(message.id) ? (
                                  <div className="flex space-x-0.5">
                                    <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                ) : (
                                  <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {message.type === "image" && message.content && (
                        <div className="relative">
                          <img
                            src={message.content}
                            alt="Shared image"
                            className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity mb-4"
                            style={{ maxWidth: 240, maxHeight: 320 }}
                            onClick={() => setPreviewImage(message.content)}
                          />
                          <div className="absolute bottom-0 right-0 flex items-center space-x-1 bg-black/20 rounded px-1 py-0.5">
                            <span className="text-xs text-white">
                              {message.timestamp}
                            </span>
                            {message.senderId === "me" && (
                              <div className="flex items-center">
                                {messageReadStatus.get(message.id) ? (
                                  <div className="flex space-x-0.5">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                ) : (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {message.type === "file" && message.content && (
                        <div className="relative pb-4">
                          <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                            <File className="h-6 w-6 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <a
                                href={message.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium underline hover:no-underline block truncate"
                              >
                                {message.fileName || 'Download file'}
                              </a>
                              <p className="text-xs text-gray-500 mt-1">{message.fileSize}</p>
                            </div>
                          </div>
                          <div className="absolute bottom-0 right-0 flex items-center space-x-1">
                            <span className={cn(
                              "text-xs",
                              message.senderId === "me" ? "text-white/70" : "text-gray-500"
                            )}>
                              {message.timestamp}
                            </span>
                            {message.senderId === "me" && (
                              <div className="flex items-center">
                                {messageReadStatus.get(message.id) ? (
                                  <div className="flex space-x-0.5">
                                    <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                ) : (
                                  <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </ScrollArea>

          {/* Scroll to Bottom Button */}
          {showScrollToBottom && (
            <Button
              onClick={() => {
                scrollToBottom();
                setNewMessageCount(0);
              }}
              className="absolute bottom-20 right-4 rounded-full w-12 h-12 p-0 bg-blue-500 hover:bg-blue-600 text-white shadow-lg z-10"
              size="sm"
            >
              <ChevronDown className="h-5 w-5" />
              {newMessageCount > 0 && (
                <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  {newMessageCount > 9 ? '9+' : newMessageCount}
                </div>
              )}
            </Button>
          )}
        </div>

        {/* Telegram-style Message Input - Always Visible */}
        <div
          className={cn(
            "bg-white border-t border-gray-200 p-3 flex-shrink-0 shadow-lg z-50 mobile-safe-area relative",
            isKeyboardVisible && "fixed bottom-0 left-0 right-0 mobile-input-focus"
          )}
          style={{
            left: isSidebarOpen && !isKeyboardVisible ? '320px' : '0',
            transition: 'left 0.3s ease',
            paddingBottom: isKeyboardVisible
              ? '8px'
              : `calc(12px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          {isTyping && selectedContact && (
            <div className="absolute -top-5 left-3" aria-live="polite">
              <div className="typing-indicator" role="status" aria-label="Typing">
                <span className="typing-indicator-dot" />
                <span className="typing-indicator-dot" />
                <span className="typing-indicator-dot" />
              </div>
            </div>
          )}
          <div className="flex items-end space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleImageButtonClick}
              disabled={isUploadingImage}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
              title="Send image"
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            <div className="flex-1 relative">
              <Input
                ref={messageInputRef}
                placeholder="Message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                className="rounded-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 px-4 py-2"
                style={{
                  fontSize: "16px",
                  minHeight: "40px",
                  lineHeight: "1.5",
                }}
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
              />
            </div>

            <div
              className="flex-shrink-0"
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
            >
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  sendMessage();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  sendMessage();
                }}
                ref={sendButtonRef}
                size="sm"
                disabled={isUploadingImage || !newMessage.trim()}
                className={cn(
                  "p-2 rounded-full transition-all duration-200",
                  newMessage.trim()
                    ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
                title="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Keep all your existing modals (Profile, Delete History, Call modals, etc.) */}
      {/* Profile Modal */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-blue-100">
                  <AvatarImage src={isEditingProfile && editedUser ? editedUser.avatar : currentUser.avatar} />
                  <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                    {(isEditingProfile && editedUser ? editedUser.username : currentUser.username)
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                {isEditingProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0 bg-blue-500 text-white hover:bg-blue-600 border-0"
                    onClick={handleAvatarUpload}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
            </div>

            {/* Profile Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                {isEditingProfile && editedUser ? (
                  <Input
                    id="username"
                    value={editedUser.username}
                    onChange={(e) => setEditedUser({ ...editedUser, username: e.target.value })}
                    className="mt-1 border-gray-200 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-600 p-2 bg-gray-50 rounded">{currentUser.username}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                {isEditingProfile && editedUser ? (
                  <Input
                    id="email"
                    type="email"
                    value={editedUser.email}
                    onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                    className="mt-1 border-gray-200 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-600 p-2 bg-gray-50 rounded">{currentUser.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                {isEditingProfile && editedUser ? (
                  <Input
                    id="bio"
                    value={editedUser.bio}
                    onChange={(e) => setEditedUser({ ...editedUser, bio: e.target.value })}
                    className="mt-1 border-gray-200 focus:border-blue-500"
                    placeholder="Tell us about yourself..."
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-600 p-2 bg-gray-50 rounded">{currentUser.bio || "No bio added"}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              {isEditingProfile ? (
                <>
                  <Button variant="outline" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={saveProfile} className="bg-blue-500 hover:bg-blue-600">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditingProfile(true)} className="bg-blue-500 hover:bg-blue-600">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete History Confirmation */}
      {showDeleteConfirm && selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 p-6">
            <h3 className="text-lg font-semibold mb-2">Delete Chat History</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete all messages with {selectedContact.name}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteHistory}>
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Incoming Call Modal */}
      {callState.isIncoming && callState.callData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 p-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Phone className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Incoming Call</h3>
                <p className="text-gray-600">{callState.callData?.callType === 'video' ? 'Video Call' : 'Voice Call'}</p>
              </div>
              <div className="flex justify-center space-x-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => webrtcManager?.rejectCall()}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  Decline
                </Button>
                <Button
                  size="lg"
                  onClick={async () => {
                    if (webrtcManager) {
                      console.log('User clicked accept call')
                      const success = await webrtcManager.acceptCall()
                      console.log('Accept call result:', success)
                    }
                  }}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Accept
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Outgoing Call Modal */}
      {callState.isOutgoing && callState.callData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 p-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Phone className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Calling...</h3>
                <p className="text-gray-600">{callState.callData?.callType === 'video' ? 'Video Call' : 'Voice Call'}</p>
              </div>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => webrtcManager?.endCall()}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  End Call
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Voice Call Modal */}
      {callState.isConnected && callState.callData && callState.callData.callType === 'voice' && (
        <div className="voice-call-container">
          <div className="voice-call-modal">
            {/* Fixed Voice Call Display */}
            <div className="voice-call-display">
              {/* Call Icon */}
              <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                <Phone className="h-16 w-16 text-white" />
              </div>
              {/* Call Status */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-semibold text-white mb-2">Voice Call</h3>
                <p className="text-lg text-gray-300">
                  {selectedContact?.name || 'Unknown Contact'}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {callState.isMuted ? 'Microphone Muted' : 'Microphone Active'}
                </p>
              </div>
              {/* Call Duration */}
              <div className="text-center">
                <p className="text-sm text-gray-400">Call in progress...</p>
              </div>
            </div>

            {/* Fixed Controls Container - Always at bottom */}
            <div className="voice-call-controls">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  console.log('Voice call mute button clicked, webrtcManager:', !!webrtcManager);
                  if (webrtcManager) {
                    webrtcManager.toggleMute();
                  } else {
                    console.error('WebRTC manager not available for voice call mute toggle');
                  }
                }}
                className={`voice-call-control-button ${callState.isMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-white text-gray-800 hover:bg-gray-200"}`}
              >
                {callState.isMuted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  console.log('Voice call end button clicked, webrtcManager:', !!webrtcManager);
                  if (webrtcManager) {
                    webrtcManager.endCall();
                  } else {
                    console.error('WebRTC manager not available for voice call end');
                  }
                }}
                className="voice-call-control-button bg-red-500 text-white hover:bg-red-600"
              >
                <PhoneOff className="h-8 w-8" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Video Call Modal */}
      {callState.isConnected && callState.callData && callState.callData.callType === 'video' && (
        <div className="video-call-container">
          <div className="video-call-modal">
            {/* Fixed Video Container */}
            <div className="video-call-video-container">
              {/* Remote Video - Fixed size container */}
              <video
                id="remoteVideo"
                autoPlay
                playsInline
                className="video-call-remote-video"
                ref={node => {
                  if (node && callState.remoteStream) {
                    node.srcObject = callState.remoteStream;
                  }
                }}
              />

              {/* Local Video - Fixed position overlay */}
              <div className="video-call-local-video">
                <video
                  id="localVideo"
                  autoPlay
                  playsInline
                  muted
                  ref={node => {
                    if (node && callState.localStream) {
                      node.srcObject = callState.localStream;
                    }
                  }}
                />
              </div>
            </div>

            {/* Fixed Controls Container - Always at bottom */}
            <div className="video-call-controls">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  console.log('Mute button clicked, webrtcManager:', !!webrtcManager);
                  if (webrtcManager) {
                    webrtcManager.toggleMute();
                  } else {
                    console.error('WebRTC manager not available for mute toggle');
                  }
                }}
                className={`video-call-control-button ${callState.isMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-white text-gray-800 hover:bg-gray-200"}`}
              >
                {callState.isMuted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  console.log('Video toggle button clicked, webrtcManager:', !!webrtcManager);
                  if (webrtcManager) {
                    webrtcManager.toggleVideo();
                  } else {
                    console.error('WebRTC manager not available for video toggle');
                  }
                }}
                className={`video-call-control-button ${!callState.isVideoEnabled ? "bg-red-500 text-white hover:bg-red-600" : "bg-white text-gray-800 hover:bg-gray-200"}`}
              >
                {!callState.isVideoEnabled ? <VideoOff className="h-8 w-8" /> : <Video className="h-8 w-8" />}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={async () => {
                  if (webrtcManager) {
                    if (typeof webrtcManager.toggleCamera === 'function') {
                      await webrtcManager.toggleCamera();
                    } else {
                      console.error('toggleCamera method not implemented on WebRTCManager');
                    }
                  } else {
                    console.error('WebRTC manager not available for camera toggle');
                  }
                }}
                className="video-call-control-button bg-white text-gray-800 hover:bg-gray-200"
                aria-label="Switch Camera"
              >
                <Camera className="h-8 w-8" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  console.log('End call button clicked, webrtcManager:', !!webrtcManager);
                  if (webrtcManager) {
                    webrtcManager.endCall();
                  } else {
                    console.error('WebRTC manager not available for end call');
                  }
                }}
                className="video-call-control-button bg-red-500 text-white hover:bg-red-600"
              >
                <PhoneOff className="h-8 w-8" />
              </Button>

            
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={() => setPreviewImage(null)}>
          <div className="relative">
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] rounded-lg" />
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 bg-white"
              onClick={e => { e.stopPropagation(); setPreviewImage(null); }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Audio Elements for Call Streams */}
      <audio ref={localAudioRef} autoPlay playsInline muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* 🔥 NEW: Reconnection Popup */}
      <ReconnectionPopup />
    </div>
  )
}