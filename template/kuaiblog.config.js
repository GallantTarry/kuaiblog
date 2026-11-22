(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.$kuaiblog = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    return {
        // 1. Site Metadata
        title: 'KuaiBlog',
        description: 'A Geek-Dark & Pastel-Light Docsify blog engine with rich media and visualization support.',
        siteUrl: 'https://example.com/',

        // 2. Content Directory (where your Markdown articles are stored)
        contentDir: 'posts',
        homeLabel: 'Home',
        homeFile: 'README.md',

        // 3. Sidebar & Theme
        sidebarTitle: 'Experience more.',
        rebootRedirectUrl: '', // URL to navigate after CRT shutdown animation (leave empty to return home)
        defaultTheme: 'dark',  // 'dark' (Geek Emerald) | 'light' (Pastel Aurora)

        // 4. Full-Text Search
        search: {
            placeholder: '🔍 Search articles...',
            noData: '😭 No matching results found!',
            depth: 6
        },

        // 5. Private Folder Lock (client-side folder password gate)
        auth: {
            enable: false,
            lockedDirKeyword: 'Private',
            password: '123456',
            title: 'Private Space',
            description: 'Please enter the access code to unlock this area',
            placeholder: 'Password',
            buttonText: 'Unlock',
            errorText: 'Incorrect password, please try again'
        },

        // 6. Media Component Defaults (@[audio] & @[video])
        media: {
            defaultArtist: 'KuaiBlog',
            defaultAlbum: 'KuaiBlog Audio',
            defaultVideoTitle: 'snapshot'
        },

        // 7. RSS 2.0 Feed Generation (feed.xml)
        rss: {
            enable: true,
            outputFile: 'feed.xml',
            maxItems: 30,
            language: 'zh-CN',
            excludeDirs: ['Private', '🔒个人创作']
        }
    };
});
