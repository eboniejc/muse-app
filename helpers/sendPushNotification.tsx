/**
 * Backend-only helper for sending push notifications via OneSignal REST API.
 * Do not import this in client-side code.
 */

import { ONESIGNAL_APP_ID } from "./_publicConfigs";

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

interface SendPushParams {
  headings: { [key: string]: string }; // e.g., { en: "Hello", vi: "Xin chào" }
  contents: { [key: string]: string }; // e.g., { en: "Message body", vi: "Nội dung" }
  playerIds?: string[]; // Specific users (OneSignal Player IDs)
  includeExternalUserIds?: string[]; // Specific users (Your database IDs)
  filters?: Array<{
    field: string;
    key?: string;
    relation: string;
    value: string;
  }>; // For tagging/filtering
  segments?: string[]; // e.g., ["All", "Active Users"]
  data?: any; // Additional data payload
  send_after?: Date; // Schedule for future delivery
}

/**
 * Sends a push notification using OneSignal API.
 * Returns the Notification ID string on success, or null on failure.
 */
export async function sendPushNotification({
  headings,
  contents,
  playerIds,
  includeExternalUserIds,
  filters,
  segments,
  data,
  send_after,
}: SendPushParams): Promise<string | null> {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    console.error(
      "ONESIGNAL_REST_API_KEY is not defined in environment variables.",
    );
    return null;
  }

  // Construct payload
  const payload: any = {
    app_id: ONESIGNAL_APP_ID,
    headings: headings,
    contents: contents,
    data: data,
  };

  if (send_after) {
    // OneSignal accepts ISO 8601 strings e.g. "2015-09-24 14:00:00 GMT-0700"
    // or standard UTC ISO strings "2015-09-24T14:00:00Z"
    payload.send_after = send_after.toISOString();
  }

  // Determine targeting strategy
  if (includeExternalUserIds && includeExternalUserIds.length > 0) {
    // New API v9+ approach for external IDs
    payload.include_aliases = {
      external_id: includeExternalUserIds,
    };
    payload.target_channel = "push";
  } else if (playerIds && playerIds.length > 0) {
    payload.include_player_ids = playerIds;
  } else if (segments && segments.length > 0) {
    payload.included_segments = segments;
  } else if (filters && filters.length > 0) {
    payload.filters = filters;
  } else {
    console.warn(
      "No targeting (includeExternalUserIds, playerIds, segments, or filters) provided for push notification.",
    );
    return null;
  }

  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to send push notification. Status: ${response.status}. Response: ${errorText}`,
      );
      return null;
    }

    const json = await response.json();
    // OneSignal might return 200 even if there are errors in the recipient list
    if (json.errors && (!json.id || json.errors.length > 0)) {
      // Sometimes warnings come back with an ID, which is technically a success.
      // But if there's no ID, it definitely failed.
      if (!json.id) {
        console.error("OneSignal API returned errors:", json.errors);
        return null;
      } else {
        console.warn(
          "OneSignal API returned warnings but created notification:",
          json.errors,
        );
      }
    }

    return json.id || null;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return null;
  }
}

/**
 * Cancels a scheduled push notification.
 * @param notificationId The ID returned from sendPushNotification
 */
export async function cancelNotification(
  notificationId: string,
): Promise<boolean> {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    console.error(
      "ONESIGNAL_REST_API_KEY is not defined in environment variables.",
    );
    return false;
  }

  const url = `${ONESIGNAL_API_URL}/${notificationId}?app_id=${ONESIGNAL_APP_ID}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to cancel push notification ${notificationId}. Status: ${response.status}. Response: ${errorText}`,
      );
      return false;
    }

    const json = await response.json();
    if (json.success === true) {
      return true;
    }

    console.error("Failed to cancel notification:", json);
    return false;
  } catch (error) {
    console.error(
      `Error cancelling push notification ${notificationId}:`,
      error,
    );
    return false;
  }
}