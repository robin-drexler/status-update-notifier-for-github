import browser from "webextension-polyfill";

import queryPr, { extractPrData } from "./query-pr.js";
import { getAllPrs, getToken, setPr, removePr } from "./storage";
import { addPrFromUrl } from "./add-pr.js";

browser.runtime.onMessage.addListener(request => {
  if (request.method === "openOptionsPage") {
    browser.runtime.openOptionsPage();
  }
});

/**
 * Whenever a new PR is opened, subscribe automatically
 * Also set initial status to pending to avoid an immediate notification
 * This might become a setting in the future
 */
browser.webRequest.onBeforeRedirect.addListener(
  async details => {
    // Sending a review also does a redirect
    // In this case we don't want to auto-subscribe
    // We determine this by checking if the original URL already is a PR
    // It cannot be a new one if it already exists :)
    if (!details.url.match(/pull\/create/)) {
      return;
    }

    const token = await getToken();
    if (!token) {
      // maybe open options page?
      // only with disable option otherwise it'd be way too annoying
      return;
    }
    console.log("Adding ", details.redirectUrl, "after PR was opened");

    addPrFromUrl({ url: details.redirectUrl, initialStatus: "PENDING", token });
  },
  {
    urls: ["https://github.com/*/pull/*"]
  }
);

function getIconForStatus(status) {
  const iconName = status.toLowerCase();

  if (["success", "failure", "pending"].includes(iconName)) {
    return `./img/${iconName}_notification.png`;
  }

  return `./img/icon_256.png`;
}

async function notificationClickHandler(notifictionId) {
  browser.notifications.clear(notifictionId);

  const { windowId } = await browser.tabs.create({ url: notifictionId });
  await browser.windows.update(windowId, { focused: true });
}

async function checkStatuses() {
  const storedPRs = await getAllPrs();

  storedPRs.map(async item => {
    const { owner, repository, number, status } = item;
    const token = await getToken();
    if (!token) {
      return;
    }

    try {
      const pr = await queryPr({ owner, repository, number, token });
      if (pr.errors) {
        return;
      }
      const { status: newStatus, url, title, state } = extractPrData(pr);
      console.log(
        "Checked PR",
        owner,
        repository,
        number,
        state,
        status,
        newStatus,
        status === newStatus
      );

      // Do not consider `null` i.e. no status as change
      if (newStatus && newStatus !== status) {
        createNotification(url, {
          type: "basic",
          title: newStatus,
          message: `${owner}/${repository}#${number}: ${title}`,
          iconUrl: getIconForStatus(newStatus),
          buttons: [{ title: "show" }],
          requireInteraction: true
        });

        await setPr({ ...item, status: newStatus });
      }

      if (state !== "OPEN") {
        console.log("Deleting PR because closed or merged", {
          owner,
          repository,
          number
        });
        await removePr({ owner, repository, number });
      }
    } catch (error) {
      console.error(error);
    }
  });
}

browser.notifications.onButtonClicked.addListener(notificationClickHandler);
browser.notifications.onClicked.addListener(notificationClickHandler);

window.setInterval(checkStatuses, 30000);
checkStatuses();

function createNotification(
  id,
  { title, message, iconUrl, type, requireInteraction, buttons }
) {
  const isFirefox = browser.runtime.getURL("/").startsWith("moz");

  const additionalOptions = isFirefox ? {} : { requireInteraction, buttons };
  return browser.notifications.create(id, {
    message,
    type,
    title,
    iconUrl,
    ...additionalOptions
  });
}

const DEBUGFUNCTIONS = {
  createNotification() {
    createNotification("https://google.com", {
      type: "basic",
      title: "PR status changed",
      message: `test test can thi\nddd`,
      iconUrl: getIconForStatus("pending"),
      buttons: [{ title: "show" }],
      requireInteraction: true
    });
  }
};

// DEBUGFUNCTIONS.createNotification();
