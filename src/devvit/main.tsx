import { Devvit, Post } from '@devvit/public-api';

// Side effect import to bundle the server
import '../server/index';
import { defineConfig } from '@devvit/server';

defineConfig({
  name: 'Bubble Wrap Popping Simulator',
  entry: 'index.html',
  height: 'tall',
  menu: { enable: false },
});

export const Preview: Devvit.BlockComponent<{ text?: string }> = ({ text = 'Loading Bubble Wrap Popper Game...' }) => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle">
      <vstack width={'100%'} height={'100%'} alignment="center middle">
        <image
          url="loading.gif"
          description="Loading Bubble Wrap Game..."
          height={'140px'}
          width={'140px'}
          imageHeight={'240px'}
          imageWidth={'240px'}
        />
        <spacer size="small" />
        <text maxWidth={`80%`} size="large" weight="bold" alignment="center middle" wrap>
          {text}
        </text>
      </vstack>
    </zstack>
  );
};

Devvit.addMenuItem({
  label: 'Bubble Wrap Popping Simulator',  // Simplified, clean menu item name
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;

    let post: Post | undefined;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      post = await reddit.submitPost({
        title: '🫧 Bubble Wrap Popper - Pop & Listen! 🔊',
        subredditName: subreddit.name,
        preview: <Preview text="Pop bubbles and listen for sounds! 30-second challenge!" />,
      });
      
      ui.showToast({ text: 'Bubble Wrap Game created!' });
      ui.navigateTo(post.url);
    } catch (error) {
      if (post) {
        await post.remove(false);
      }
      if (error instanceof Error) {
        ui.showToast({ text: `Error creating game: ${error.message}` });
      } else {
        ui.showToast({ text: 'Error creating game session!' });
      }
    }
  },
});

export default Devvit;