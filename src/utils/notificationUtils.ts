import { ref, push, set, get } from 'firebase/database';
import { database } from '../firebase';
import * as jose from 'jose';

export const getFCMv1AccessToken = async (serviceAccount: any): Promise<string | null> => {
    try {
        const { client_email, private_key } = serviceAccount;

        if (!private_key || !client_email) {
            console.error('❌ Service Account bilgileri eksik');
            return null;
        }

        let cleanKey = private_key.replace(/["']/g, '').trim();

        if (cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
            const header = '-----BEGIN PRIVATE KEY-----';
            const footer = '-----END PRIVATE KEY-----';
            let body = cleanKey.replace(header, '').replace(footer, '').replace(/\s+/g, '');
            cleanKey = `${header}\n${body}\n${footer}`;
        }

        const jwt = await new jose.SignJWT({
            scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/cloud-platform',
        })
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuedAt()
            .setIssuer(client_email)
            .setAudience('https://oauth2.googleapis.com/token')
            .setExpirationTime('1h')
            .sign(await jose.importPKCS8(cleanKey, 'RS256'));

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            console.error('❌ Google Token Alınamadı. Yanıt:', tokenData);
            return null;
        }

        return tokenData.access_token;
    } catch (error: any) {
        console.error('❌ Access Token hatası:', error.message);
        return null;
    }
};

export const sendFCMv1Notification = async (
    fcmToken: string,
    title: string,
    body: string,
    projectId: string,
    accessToken: string,
    data: Record<string, string> = {}
): Promise<boolean> => {
    try {
        const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

        const messagePayload = {
            message: {
                token: fcmToken,
                notification: { title, body },
                data: Object.fromEntries(
                    Object.entries(data).map(([k, v]) => [k, String(v)])
                ),
                apns: {
                    headers: {
                        'apns-priority': '10',
                        'apns-topic': 'app.neo.playlearnkids',
                    },
                    payload: {
                        aps: {
                            alert: { title, body },
                            sound: 'default',
                            badge: 1,
                            'mutable-content': 1,
                        }
                    }
                }
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload),
        });

        const result = await response.json();

        if (result.name) {
            return true;
        } else {
            console.error('❌ FCM V1 Hatası:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ FCM V1 Fetch Hatası:', error);
        return false;
    }
};

export const sendNotificationDirectly = async (
    userId: string,
    notificationData: {
        titleTr: string;
        titleEn?: string;
        messageTr: string;
        messageEn?: string;
        type: string;
        data?: any
    }
) => {
    try {
        const notificationsRef = ref(database, 'notifications');
        const newNotificationRef = push(notificationsRef);

        const notification = {
            userId,
            type: notificationData.type,
            title: {
                tr: notificationData.titleTr,
                en: notificationData.titleEn || notificationData.titleTr,
            },
            message: {
                tr: notificationData.messageTr,
                en: notificationData.messageEn || notificationData.messageTr,
            },
            read: false,
            createdAt: new Date().toISOString(),
            data: notificationData.data || {},
        };

        await set(newNotificationRef, notification);

        // Try to send push notification
        const tokenRef = ref(database, `pushTokens/${userId}`);
        const tokenSnap = await get(tokenRef);

        if (tokenSnap.exists()) {
            const tokenData = tokenSnap.val();
            const pushToken = tokenData.token;
            const tokenType = tokenData.tokenType || 'expo';

            if (pushToken) {
                if (tokenType === 'fcm') {
                    const saRef = ref(database, 'configuration/fcmServiceAccount');
                    const saSnap = await get(saRef);
                    if (saSnap.exists()) {
                        const sa = saSnap.val();
                        const accessTok = await getFCMv1AccessToken(sa);
                        if (accessTok) {
                            await sendFCMv1Notification(
                                pushToken,
                                notificationData.titleTr,
                                notificationData.messageTr,
                                sa.project_id,
                                accessTok,
                                {
                                    ...notificationData.data,
                                    type: notificationData.type,
                                    title: notificationData.titleTr,
                                    message: notificationData.messageTr
                                }
                            );
                        }
                    }
                } else if (tokenType === 'apns' || (!pushToken.startsWith('ExponentPushToken'))) {
                    const configRef = ref(database, 'configuration/fcmServerKey');
                    const configSnap = await get(configRef);
                    const fcmServerKey = configSnap.val();

                    if (fcmServerKey) {
                        await fetch('https://fcm.googleapis.com/fcm/send', {
                            method: 'POST',
                            headers: {
                                'Authorization': `key=${fcmServerKey}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                to: pushToken,
                                notification: {
                                    title: notificationData.titleTr,
                                    body: notificationData.messageTr,
                                    sound: 'default',
                                },
                                data: {
                                    ...notificationData.data,
                                    type: notificationData.type,
                                    title: notificationData.titleTr,
                                    message: notificationData.messageTr,
                                },
                                priority: 'high'
                            }),
                        });
                    }
                } else {
                    // Expo token
                    await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Accept-encoding': 'gzip, deflate',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            to: pushToken,
                            sound: 'default',
                            title: notificationData.titleTr,
                            body: notificationData.messageTr,
                            data: {
                                ...notificationData.data,
                                type: notificationData.type,
                                title: notificationData.titleTr,
                                message: notificationData.messageTr
                            },
                            priority: 'high',
                            channelId: 'default'
                        }),
                    });
                }
            }
        }
        return { success: true };
    } catch (error) {
        console.error('Error sending notification directly:', error);
        return { success: false, error: (error as Error).message };
    }
};
