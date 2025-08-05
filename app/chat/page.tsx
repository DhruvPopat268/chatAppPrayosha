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
  content: string
  timestamp: string
  type: "text" | "image" | "file" | "voice"
  fileName?: string
  fileSize?: string
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const isSendButtonClickedRef = useRef(false);
  const [searchedUsers, setSearchedUsers] = useState<ApiUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [userContacts, setUserContacts] = useState<Contact[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
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
        const webrtc = new WebRTCManager(socket)
        setWebrtcManager(webrtc)

        // Listen for call state changes
        webrtc.onStateChange((state) => {
          setCallState(state)
        })
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
        const newMessage: Message = {
          id: message._id,
          senderId: message.senderId._id === currentUser.id ? "me" : message.senderId._id,
          content: message.content,
          timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
          type: message.type,
          fileName: message.fileName,
          fileSize: message.fileSize,
        }
        setMessages(prev => [...prev, newMessage])
      }

      // Update contact's last message
      setUserContacts(prev => prev.map(contact => {
        if (contact.id === message.senderId._id) {
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
    };

    const handleOffline = () => {
      console.log('📴 User is offline');
      setIsOnline(false);
      setConnectionStatus('disconnected');
      setLastSeen(Date.now());
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
  }, []);

  // Track socket connection status
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    const handleConnect = () => {
      console.log('🔌 Socket connected');
      setConnectionStatus('connected');
    };

    const handleDisconnect = () => {
      console.log('🔌 Socket disconnected');
      setConnectionStatus('disconnected');
      setLastSeen(Date.now());
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
  }, [socketManager]);

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

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedContact || !currentUser) return;

    // Set flag to prevent blur
    isSendButtonClickedRef.current = true;

    // Immediately refocus the input to prevent blur
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }

    // Send message via Socket.IO
    socketManager.sendMessage(selectedContact.id, newMessage, "text");

    // Add message to local state immediately for optimistic UI
    const message: Message = {
      id: Date.now().toString(),
      senderId: "me",
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
      type: "text",
    };

    setMessages(prev => [...prev, message]);
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
    const message: Message = {
      id: Date.now().toString(),
      senderId: "me",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
      type: type,
      fileName: type === "file" ? "document.pdf" : undefined,
      fileSize: type === "file" ? "2.4 MB" : undefined,
    }

    setMessages([...messages, message])
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
  const loadMessages = async (contactId: string) => {
    setIsLoadingMessages(true)
    try {
      const response = await apiCall(`${config.getBackendUrl()}/api/messages/${contactId}`)
      if (response.ok) {
        const messagesData = await response.json()
        const formattedMessages: Message[] = messagesData.map((msg: any) => ({
          id: msg._id,
          senderId: msg.senderId._id === currentUser?.id ? "me" : msg.senderId._id,
          content: msg.content,
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
          type: msg.type,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
        }))
        setMessages(formattedMessages)
      } else {
        console.error('Failed to load messages')
        setMessages([])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
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
        content: url,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
        type: "image",
      };
      setMessages(prev => [...prev, message]);
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
        content: url,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
        type: "file",
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      };
      setMessages(prev => [...prev, message]);
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

  return (
    <div className="flex h-screen bg-gray-50 relative overflow-hidden">
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
            background: white !important;
            border-bottom: 1px solid #e5e7eb !important;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1) !important;
          }
        }
      `}</style>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-5 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out relative",
          isSidebarOpen
            ? "w-80 fixed md:relative inset-y-0 left-0 md:left-auto z-10"
            : "w-0 md:w-12 overflow-hidden z-20 md:z-auto"
        )}
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
              {/* Header */}
              <div className="p-4 border-b border-gray-200 pt-16">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.avatar || "/placeholder.svg"} />
                      <AvatarFallback>
                        {currentUser.username
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <h1 className="text-xl font-semibold">Messages</h1>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Notification Status Indicator */}
                    <div className="flex items-center space-x-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        notifEnabled ? "bg-green-500" : "bg-gray-300"
                      )} />
                      <span className="text-xs text-gray-500">
                        {notifEnabled ? "Notifications" : "No Notifications"}
                      </span>
                    </div>
                    
                    <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add Friends</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                              placeholder="Search people..."
                              value={friendSearchQuery}
                              onChange={(e) => setFriendSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>

                          {/* Searched Users */}
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
                                    <div key={user._id} className="flex items-center justify-between p-2 rounded-lg border">
                                      <div className="flex items-center space-x-3">
                                        <Avatar className="h-8 w-8">
                                          <AvatarImage src="/placeholder.svg" />
                                          <AvatarFallback>
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
                                      <Button size="sm" variant="outline" onClick={() => addFriend(user)}>
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
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={forceOneSignalSubscription}>
                          <Bell className="h-4 w-4 mr-2" />
                          {notifEnabled ? 'Notifications Enabled' : 'Enable Notifications'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                          <User className="h-4 w-4 mr-2" />
                          My Profile
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Contacts List */}
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => {
                        setSelectedContact(contact)
                      }}
                      className={cn(
                        "flex items-center p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors",
                        selectedContact?.id === contact.id && "bg-blue-50 border border-blue-200",
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={contact.avatar || "/placeholder.svg"} />
                          <AvatarFallback>
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
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                          <p className="text-xs text-gray-500">{contact.timestamp}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500 truncate">{contact.lastMessage}</p>
                          {contact.unread > 0 && (
                            <Badge
                              variant="default"
                              className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                            >
                              {contact.unread}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            // Collapsed sidebar - show only essential buttons
            <div className="hidden md:flex flex-col items-center py-4 space-y-4 pt-16">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSidebarOpen(true)
                  setIsAddFriendOpen(true)
                }}
                className="p-2 rounded-full"
                title="Add Friends"
              >
                <UserPlus className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2 rounded-full" title="Menu">
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

      {/* Main Chat Area */}
      <div
        ref={chatContainerRef}
        className={cn(
          "flex-1 flex flex-col bg-white relative",
          isSidebarOpen ? "z-0" : "z-10"
        )}
        style={{
          height: isKeyboardVisible && typeof window !== "undefined" && window.visualViewport
            ? `${window.visualViewport?.height || window.innerHeight}px`
            : "100vh",
          // Mobile-specific height handling
          minHeight: "100vh",
          maxHeight: "100vh",
          // Add top padding when header is fixed (keyboard visible)
          paddingTop: isKeyboardVisible ? "80px" : "0px", // Adjust based on header height
        }}
      >
        {/* Sticky Header - Always visible with conditional z-index */}
        <div className={cn(
          "sticky top-0 bg-white border-b border-gray-200 shadow-sm backdrop-blur-sm bg-white/95 z-50",
          isSidebarOpen ? "z-50" : "z-50", // Always high z-index for mobile
          isKeyboardVisible && "mobile-header-visible" // Add mobile-specific class when keyboard is visible
        )}
          style={{
            // Ensure header stays visible even when keyboard is open
            position: isKeyboardVisible ? 'fixed' : 'sticky',
            top: isKeyboardVisible ? '0' : '0',
            left: '0',
            right: '0',
            zIndex: 9999, // Ensure it's always on top
          }}>
          {/* Contact header - Always visible */}
          {selectedContact ? (
            <div className="p-4 flex items-center justify-between flex-shrink-0 border-t border-gray-100">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Avatar>
                  <AvatarImage src={selectedContact?.avatar || "/placeholder.svg"} />
                  <AvatarFallback>
                    {selectedContact?.name
                      ? selectedContact.name.split(" ").map((n) => n[0]).join("")
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedContact?.name || "No Contact"}</h3>
                  <p className="text-sm text-gray-500">
                    {isTyping
                      ? "Typing..."
                      : contactStatus.online
                        ? "Online"
                        : contactStatus.lastSeen
                          ? `Last seen ${getOfflineStatusMessage(contactStatus.lastSeen)}`
                          : "Offline"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Voice Call Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 rounded-full hover:bg-gray-100"
                  onClick={async () => {
                    if (webrtcManager && selectedContact) {
                      console.log('Starting voice call to:', selectedContact.id);
                      console.log('Socket status:', socketManager.getConnectionStatus());
                      console.log('WebRTC manager state:', webrtcManager.getConnectionDiagnostics());

                      const success = await webrtcManager.startVoiceCall(selectedContact.id);
                      if (!success) {
                        console.error('Failed to start voice call');
                      }
                    } else {
                      console.error('Cannot start voice call:', {
                        webrtcManager: !!webrtcManager,
                        selectedContact: !!selectedContact,
                        socketReady: socketManager.isReadyForCalls()
                      });
                    }
                  }}
                  disabled={!webrtcManager || !selectedContact || callState.isIncoming || callState.isOutgoing || callState.isConnected || connectionStatus !== 'connected'}
                  title={connectionStatus !== 'connected' ? "Not connected to server" : "Start voice call"}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                {/* Video Call Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 rounded-full hover:bg-gray-100"
                  onClick={async () => {
                    if (webrtcManager && selectedContact) {
                      console.log('Starting video call to:', selectedContact.id);
                      console.log('Socket status:', socketManager.getConnectionStatus());
                      console.log('WebRTC manager state:', webrtcManager.getConnectionDiagnostics());

                      const success = await webrtcManager.startVideoCall(selectedContact.id);
                      if (!success) {
                        console.error('Failed to start video call');
                      }
                    } else {
                      console.error('Cannot start video call:', {
                        webrtcManager: !!webrtcManager,
                        selectedContact: !!selectedContact,
                        socketReady: socketManager.isReadyForCalls()
                      });
                    }
                  }}
                  disabled={!webrtcManager || !selectedContact || callState.isIncoming || callState.isOutgoing || callState.isConnected || connectionStatus !== 'connected'}
                  title={connectionStatus !== 'connected' ? "Not connected to server" : "Start video call"}
                >
                  <Video className="h-4 w-4" />
                </Button>

                {/* More Options Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={forceOneSignalSubscription}>
                      <Bell className="h-4 w-4 mr-2" />
                      {notifEnabled ? 'Notifications Enabled' : 'Enable Notifications'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete History
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            <div className="p-4 flex items-center justify-center flex-shrink-0 border-t border-gray-100">
              <div className="text-center">
                <h3 className="font-semibold text-gray-500">Select a contact to start chatting</h3>
                <p className="text-sm text-gray-400 mt-1">Choose someone from your contacts list</p>
              </div>
            </div>
          )}
        </div>

        {/* Messages - Scrollable area with proper spacing for sticky footer */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea
            ref={scrollAreaRef}
            className={cn(
              "h-full p-4 pb-24", // Increased bottom padding for mobile
              isKeyboardVisible && "pt-20" // Add top padding when header is fixed
            )}
            onScroll={handleScroll}
          >
            <div className="space-y-4 pb-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm text-gray-500">Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Start a conversation with {selectedContact?.name || 'your contact'} by sending your first message!
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex mb-4", message.senderId === "me" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm",
                        message.senderId === "me"
                          ? "bg-blue-500 text-white rounded-br-md"
                          : "bg-gray-100 text-gray-900 rounded-bl-md border border-gray-200"
                      )}
                    >
                      {message.type === "text" && (
                        <p className="text-sm leading-relaxed break-words">{message.content}</p>
                      )}
                      {message.type === "image" && message.content && (
                        <div className="space-y-2">
                          <img
                            src={message.content}
                            alt="Shared image"
                            className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ maxWidth: 240, maxHeight: 320 }}
                            onClick={() => setPreviewImage(message.content)}
                          />
                        </div>
                      )}
                      {message.type === "file" && message.content && (
                        <div className="flex items-center space-x-3 p-3 bg-white bg-opacity-20 rounded-lg">
                          <File className="h-8 w-8 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <a
                              href={message.content}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium underline hover:no-underline block truncate"
                            >
                              {message.fileName || 'Download file'}
                            </a>
                            <p className="text-xs opacity-70 mt-1">{message.fileSize}</p>
                          </div>
                        </div>
                      )}
                      <p className={cn(
                        "text-xs mt-2 opacity-70",
                        message.senderId === "me" ? "text-right" : "text-left"
                      )}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} className="h-4" /> {/* Add height to ensure proper scrolling */}
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
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500">
                  {newMessageCount > 9 ? '9+' : newMessageCount}
                </Badge>
              )}
            </Button>
          )}
        </div>

        {/* Message Input - Sticky Footer - Always visible */}
        <div
          className={cn(
            "sticky bottom-0 bg-white border-t border-gray-200 p-4 flex-shrink-0 shadow-lg backdrop-blur-sm bg-white/95 z-50 mobile-safe-area",
            isSidebarOpen ? "z-50" : "z-50", // Always high z-index for mobile
            isKeyboardVisible && "mobile-input-focus" // Add mobile-specific class when keyboard is visible
          )}
          style={{
            // Ensure the input sits directly on top of the keyboard
            bottom: isKeyboardVisible ? '0' : '0',
            // Add safe area padding for mobile devices
            paddingBottom: isKeyboardVisible
              ? '8px'
              : `calc(16px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          {/* Subtle top border indicator */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 opacity-50"></div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleImageButtonClick}
              disabled={isUploadingImage}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Send image"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFileButtonClick}
              disabled={isUploadingImage}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Send file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex-1 relative">
              <Input
                ref={messageInputRef}
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                className="pr-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{
                  fontSize: "16px", // Prevents zoom on iOS
                  minHeight: "44px", // Better touch target for mobile
                  lineHeight: "1.5",
                }}
                // Mobile-specific attributes
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
                <Avatar className="h-24 w-24">
                  <AvatarImage src={isEditingProfile && editedUser ? editedUser.avatar : currentUser.avatar} />
                  <AvatarFallback className="text-2xl">
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
                    className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0 bg-transparent"
                    onClick={handleAvatarUpload}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {/* Use handleAvatarFileChange for avatar input */}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
            </div>

            {/* Profile Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                {isEditingProfile && editedUser ? (
                  <Input
                    id="username"
                    value={editedUser.username}
                    onChange={(e) => setEditedUser({ ...editedUser, username: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-600">{currentUser.username}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                {isEditingProfile && editedUser ? (
                  <Input
                    id="email"
                    type="email"
                    value={editedUser.email}
                    onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-600">{currentUser.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                {isEditingProfile && editedUser ? (
                  <Input
                    id="bio"
                    value={editedUser.bio}
                    onChange={(e) => setEditedUser({ ...editedUser, bio: e.target.value })}
                    className="mt-1"
                    placeholder="Tell us about yourself..."
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-600">{currentUser.bio}</p>
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
                  <Button onClick={saveProfile}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditingProfile(true)}>
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
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl p-4 flex flex-col items-center relative">
            {/* Voice Call Controls - Large, always visible */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-6 z-10">
              <Button
                variant="outline"
                size="lg"
                onClick={() => webrtcManager?.toggleMute()}
                className={callState.isMuted ? "bg-red-500 text-white hover:bg-red-600 border-none" : "bg-white text-gray-800 hover:bg-gray-200 border-none shadow"}
                style={{ width: 56, height: 56, borderRadius: 28, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {callState.isMuted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => webrtcManager?.endCall()}
                className="bg-red-500 text-white hover:bg-red-600 border-none shadow"
                style={{ width: 56, height: 56, borderRadius: 28, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <PhoneOff className="h-8 w-8" />
              </Button>
            </div>
            <div className="relative w-full flex flex-col items-center">
              {/* Voice Call Display */}
              <div className="w-full max-w-md flex flex-col items-center justify-center min-h-[60vh]">
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
                {/* Call Duration (if needed) */}
                <div className="text-center">
                  <p className="text-sm text-gray-400">Call in progress...</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Video Call Modal */}
      {callState.isConnected && callState.callData && callState.callData.callType === 'video' && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl p-4 flex flex-col items-center relative">
            {/* Video Controls - Large, always visible */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-6 z-10">
              <Button
                variant="outline"
                size="lg"
                onClick={() => webrtcManager?.toggleMute()}
                className={callState.isMuted ? "bg-red-500 text-white hover:bg-red-600 border-none" : "bg-white text-gray-800 hover:bg-gray-200 border-none shadow"}
                style={{ width: 56, height: 56, borderRadius: 28, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {callState.isMuted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => webrtcManager?.endCall()}
                className="bg-red-500 text-white hover:bg-red-600 border-none shadow"
                style={{ width: 56, height: 56, borderRadius: 28, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <PhoneOff className="h-8 w-8" />
              </Button>
            </div>
            <div className="relative w-full flex flex-col items-center">
              {/* Remote Video */}
              <video
                id="remoteVideo"
                autoPlay
                playsInline
                style={{ width: '100%', maxHeight: '60vh', background: '#222', borderRadius: '12px' }}
                ref={node => {
                  if (node && callState.remoteStream) {
                    node.srcObject = callState.remoteStream;
                  }
                }}
              />
              {/* Local Video (small overlay) */}
              <video
                id="localVideo"
                autoPlay
                playsInline
                muted
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  width: '120px',
                  height: '90px',
                  background: '#444',
                  borderRadius: '8px',
                  border: '2px solid #fff',
                  objectFit: 'cover',
                }}
                ref={node => {
                  if (node && callState.localStream) {
                    node.srcObject = callState.localStream;
                  }
                }}
              />
            </div>
          </Card>
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

      {/* Audio Elements for Call Streams - Using refs to prevent re-render issues */}
      <audio
        ref={localAudioRef}
        autoPlay
        playsInline
        muted
        style={{ display: 'none' }}
      />
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
      />



    </div>
  )
}