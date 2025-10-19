// lib/userRoleHelper.ts
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

/**
 * Get the target UID for data operations based on user role and connection
 * - Elders: return their own UID (data is stored with their UID by family members)
 * - Family members: return their connected elder's UID
 * - Returns null if no connection found for family members
 */
export async function getTargetUid(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  
  const usersRef = collection(db, 'users');
  const userUid = currentUser.uid;
  
  console.log('Getting target UID for user:', userUid);
  
  try {
    // First, try to get user by document ID (most common case)
    const userDoc = await getDoc(doc(usersRef, userUid));
    if (userDoc.exists()) {
      const userData = userDoc.data() as any;
      console.log('User found by doc ID, role:', userData?.role);
      
      if (userData?.role === 'family') {
        // For family members, find connected elder
        const eldersQuery = query(usersRef, where('role', '==', 'elder'), where('connectedTo', '==', userUid));
        const eldersSnapshot = await getDocs(eldersQuery);
        if (!eldersSnapshot.empty) {
          const elderUid = eldersSnapshot.docs[0].data().uid || eldersSnapshot.docs[0].id;
          console.log('Family member connected to elder:', elderUid);
          return elderUid;
        } else {
          console.log('No connected elder found for family member');
          return null;
        }
      } else if (userData?.role === 'elder') {
        // For elders, return their own UID (family members store data with elder's UID)
        console.log('User is elder, returning own UID:', userUid);
        return userUid;
      }
    }
    
    // If not found by document ID, try by uid field
    const uidQuery = query(usersRef, where('uid', '==', userUid));
    const uidSnapshot = await getDocs(uidQuery);
    if (!uidSnapshot.empty) {
      const userData = uidSnapshot.docs[0].data() as any;
      console.log('User found by uid field, role:', userData?.role);
      
      if (userData?.role === 'family') {
        // For family members, find connected elder
        const eldersQuery = query(usersRef, where('role', '==', 'elder'), where('connectedTo', '==', userUid));
        const eldersSnapshot = await getDocs(eldersQuery);
        if (!eldersSnapshot.empty) {
          const elderUid = eldersSnapshot.docs[0].data().uid || eldersSnapshot.docs[0].id;
          console.log('Family member connected to elder (uid field):', elderUid);
          return elderUid;
        } else {
          console.log('No connected elder found for family member (uid field)');
          return null;
        }
      } else if (userData?.role === 'elder') {
        // For elders, return their own UID
        console.log('User is elder (uid field), returning own UID:', userUid);
        return userUid;
      }
    }
    
    // If still not found, try reverse lookup for elders (check if someone is connected to this user)
    const connectedToQuery = query(usersRef, where('connectedTo', '==', userUid));
    const connectedToSnapshot = await getDocs(connectedToQuery);
    if (!connectedToSnapshot.empty) {
      // This user has someone connected to them, so they are likely an elder
      console.log('User has someone connected to them, assuming elder role:', userUid);
      return userUid;
    }
    
    // Last resort: if no role found but user exists, assume they are an elder
    // (this handles cases where user documents might not have role field set properly)
    console.log('No role found for user, assuming elder role:', userUid);
    return userUid;
    
  } catch (error) {
    console.error('Error getting target UID:', error);
    return null;
  }
}

/**
 * Check if the current user is a family member
 */
export async function isFamilyMember(): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;
  
  const usersRef = collection(db, 'users');
  const userUid = currentUser.uid;
  
  try {
    const userDoc = await getDoc(doc(usersRef, userUid));
    if (userDoc.exists()) {
      const userData = userDoc.data() as any;
      return userData?.role === 'family';
    } else {
      const uidQuery = query(usersRef, where('uid', '==', userUid));
      const uidSnapshot = await getDocs(uidQuery);
      if (!uidSnapshot.empty) {
        const userData = uidSnapshot.docs[0].data() as any;
        return userData?.role === 'family';
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
}

