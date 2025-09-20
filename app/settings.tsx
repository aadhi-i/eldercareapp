import React from 'react';
import DrawerLayout from '../components/DrawerLayout';
import ProfileSettings from '../components/ProfileSettings';

export default function ProfileScreen() {
  return (
    <DrawerLayout menuTitle="Profile">
      <ProfileSettings />
    </DrawerLayout>
  );
}



