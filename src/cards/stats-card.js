const I18n = require("../common/I18n");
const Card = require("../common/Card");
const icons = require("../common/icons");
const { getStyles } = require("../getStyles");
const { statCardLocales } = require("../translations");
const {
    kFormatter,
    FlexLayout,
    clampValue,
    measureText,
    getCardColors,
} = require("../common/utils");

// const createTextNode = ({
//   icon,
//   label,
//   value,
//   id,
//   index,
//   showIcons,
//   shiftValuePos,
// }) => {
//   const kValue = value;
//   const staggerDelay = (index + 3) * 150;

//   const labelOffset = showIcons ? `x="25"` : "";
//   const iconSvg = showIcons
//     ? `
//     <svg viewBox="0 0 20 20" version="1.1" width="200" height="200">
//       ${icon}
//     </svg>
//   `
//     : "";
//   return `
//     <g class="stagger" style="animation-delay: ${staggerDelay}ms" transform="translate(25, 0)">
//       ${iconSvg}
//       <text class="stat bold" ${labelOffset} y="21">${label}:</text>
//       <text 
//         class="stat" 
//         x="${(showIcons ? 140 : 120) + shiftValuePos + 20}" 
//         y="21" 
//         data-testid="${id}"
//       >${kValue}</text>
//     </g>
//   `;
// };

const createTextNode2 = ({
    icon,
    label,
    value,
    id,
    index,
    showIcons,
    shiftValuePos,
}) => {
    const kValue = value;
    const staggerDelay = (index + 3) * 150;

    const labelOffset = showIcons ? `x="25"` : "";
    let shift = 0;
    if (index == 2) {
        shift = 27;
    }
    else if (index == 1) {
        shift = 39;
    }
    else {
        shift = 40;
    }
    const numShift = index == 1 ? 43 : 52;
    const iconSvg = showIcons
        ? `
      <svg data-testid="icon" class="icon" viewBox="0 0 20 20" version="1.1" width="80" height="80" x="42" y="0">
        ${icon}
      </svg>
    `
        : "";
    return `
      <g class="stagger" style="animation-delay: ${staggerDelay}ms" transform="translate(25, 0)">
        ${iconSvg}
        <text class="stat small" x="${shift}" y="85">${label}</text>
        <text 
          class="stat bold" 
          x="${numShift}" 
          y="105" 
          data-testid="${id}"
        >${kValue}</text>
      </g>
    `;
};

const renderStatsCard = (stats = {}, options = { hide: [] }) => {
    const {
        name,
        totalStars,
        totalCommits,
        totalIssues,
        totalPRs,
        contributedTo,
        totalViews,
        rank,
    } = stats;
    const {
        hide = [],
        show_icons = false,
        hide_title = false,
        hide_border = false,
        hide_rank = false,
        include_all_commits = false,
        line_height = 31.5,
        title_color,
        icon_color,
        text_color,
        bg_color,
        theme = "default",
        custom_title,
        locale,
        disable_animations = false,
    } = options;

    const lheight = parseInt(line_height, 10);

    // returns theme based colors with proper overrides and defaults
    const { titleColor, textColor, iconColor, bgColor } = getCardColors({
        title_color,
        icon_color,
        text_color,
        bg_color,
        theme,
    });

    const apostrophe = ["x", "s"].includes(name.slice(-1).toLocaleLowerCase())
        ? ""
        : "s";
    const i18n = new I18n({
        locale,
        translations: statCardLocales({ name, apostrophe }),
    });

    // Meta data for creating text nodes with createTextNode function
    const STATS = {
        stars: {
            icon: icons.star,
            label: i18n.t("statcard.totalstars"),
            value: totalStars,
            id: "stars",
        },
        views: {
            icon: icons.medium2,
            label: "Total Views",
            value: totalViews,
            id: "views"
        },
        commits: {
            icon: icons.commits,
            label: `${i18n.t("statcard.commits")}${include_all_commits ? "" : ` (${new Date().getFullYear()})`
                }`,
            value: totalCommits,
            id: "commits",
        },
        prs: {
            icon: icons.prs,
            label: i18n.t("statcard.prs"),
            value: totalPRs,
            id: "prs",
        },
        issues: {
            icon: icons.issues,
            label: i18n.t("statcard.issues"),
            value: totalIssues,
            id: "issues",
        },
        contribs: {
            icon: icons.contribs,
            label: i18n.t("statcard.contribs"),
            value: contributedTo,
            id: "contribs",
        },
    };

    console.log(i18n.t("statcard.totalstars"));

    const longLocales = ["cn", "es", "fr", "pt-br", "ru", "uk-ua", "id", "my", "pl"];
    const isLongLocale = longLocales.includes(locale) === true;

    // filter out hidden stats defined by user & create the text nodes
    const statItems = Object.keys(STATS)
        .filter((key) => !hide.includes(key))
        .map((key, index) =>
            // create the text nodes, and pass index so that we can calculate the line spacing
            createTextNode2({
                ...STATS[key],
                index,
                showIcons: show_icons,
                shiftValuePos:
                    (!include_all_commits ? 50 : 20) + (isLongLocale ? 50 : 0),
            }),
        );

    // Calculate the card height depending on how many items there are
    // but if rank circle is visible clamp the minimum height to `150`
    let height = Math.max(
        45 + (statItems.length + 1) * lheight,
        hide_rank ? 0 : 150,
    );

    // Conditionally rendered elements
    const rankCircle = hide_rank
        ? ""
        : `<g data-testid="rank-circle" 
          transform="translate(400, ${height / 2 - 50})">
        <circle class="rank-circle-rim" cx="-10" cy="8" r="40" />
        <circle class="rank-circle" cx="-10" cy="8" r="40" />
        <g class="rank-text">
          <text
            x="${rank.level.length === 1 ? "-4" : "0"}"
            y="0"
            alignment-baseline="central"
            dominant-baseline="central"
            text-anchor="middle"
          >
            S++
          </text>
        </g>
      </g>`;

    // the better user's score the the rank will be closer to zero so
    // subtracting 100 to get the progress in 100%
    const progress = 100 - rank.score;
    const cssStyles = getStyles({
        titleColor,
        textColor,
        iconColor,
        show_icons,
        progress,
    });

    const calculateTextWidth = () => {
        return measureText(custom_title ? custom_title : i18n.t("statcard.title"));
    };

    const width = hide_rank
        ? clampValue(
            50 /* padding */ + calculateTextWidth() * 2,
            270 /* min */,
            Infinity,
        )
        : 495;

    const card = new Card({
        customTitle: custom_title,
        defaultTitle: i18n.t("statcard.title"),
        width,
        height,
        colors: {
            titleColor,
            textColor,
            iconColor,
            bgColor,
        },
    });

    card.setHideBorder(hide_border);
    card.setHideTitle(hide_title);
    card.setCSS(cssStyles);

    if (disable_animations) card.disableAnimations();

    return card.render(`
    ${rankCircle}
    <svg x="-40" y="0">
      ${FlexLayout({
        items: statItems,
        gap: lheight * 3.4,
        direction: "",
        labelShift: 10,
    }).join("")}
    </svg>
  `);
};

{/* <svg x="0" y="0">
      ${FlexLayout({
        items: statItems,
        gap: lheight,
        direction: "column",
      }).join("")}
    </svg>  */}

module.exports = renderStatsCard;
