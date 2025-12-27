export interface User {
  id: number;
  username: string;
  password?: string; // Only needed for auth logic
  role: 'user' | 'admin';
  nickname: string;
  avatar: string;
  phone_number?: string;
  mode?: 'public' | 'private';
  isVisible: boolean;
  createdAt: string;
}

export interface FriendRequest {
  from_id: number;
  to_id: number;
  from_user?: User;
  to_user?: User;
  createdAt?: string;
}

export interface Group {
  id: number;
  name: string;
  avatar: string;
  admin_id: number;
  createdAt: string;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id?: number | null;
  group_id?: number | null;
  content: string;
  fileUrl?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  timestamp: string;
  is_read?: boolean;
  // Joins
  sender?: User;
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'friend_request_rejected' | 'friend_request_accepted' | 'message' | 'call';
  title: string;
  message?: string;
  related_user_id?: number | null;
  is_read: boolean;
  createdAt: string;
  // Joins
  related_user?: User;
}
