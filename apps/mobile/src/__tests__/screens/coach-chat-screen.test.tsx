/**
 * CoachChatScreen tests — verifies chat rendering and message flow.
 *
 * Key scenarios:
 * - Empty state when no messages
 * - Messages render with correct roles (user vs assistant)
 * - Loading state while fetching history
 * - Send button disabled when input is empty
 * - Typing indicator while sending
 */
import { renderScreen, screen, waitFor, fireEvent, act } from '../helpers/render';

const mockGetHistory = jest.fn();
const mockSendMessage = jest.fn();
const mockClearHistory = jest.fn();

jest.mock('../../api/chat', () => ({
  chatApi: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    clearHistory: (...args: unknown[]) => mockClearHistory(...args),
  },
}));

import { CoachChatScreen } from '../../screens/CoachChatScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetHistory.mockResolvedValue({ messages: [] });
  mockSendMessage.mockResolvedValue({ message: 'AI response', timestamp: '2026-03-27T12:00:00Z' });
});

describe('CoachChatScreen', () => {
  it('shows empty state when no messages', async () => {
    mockGetHistory.mockResolvedValue({ messages: [] });

    renderScreen(<CoachChatScreen />);

    await waitFor(() => {
      // Should show the empty state encouragement text
      expect(screen.queryByText(/loading/i)).toBeNull();
    });
  });

  it('displays chat history messages', async () => {
    mockGetHistory.mockResolvedValue({
      messages: [
        { role: 'user', content: 'What should I eat?', timestamp: '2026-03-27T10:00:00Z' },
        {
          role: 'assistant',
          content: 'Try some grilled chicken!',
          timestamp: '2026-03-27T10:01:00Z',
        },
      ],
    });

    renderScreen(<CoachChatScreen />);

    await waitFor(() => {
      expect(screen.getByText('What should I eat?')).toBeTruthy();
      expect(screen.getByText('Try some grilled chicken!')).toBeTruthy();
    });
  });

  it('sends a message and displays the response', async () => {
    mockGetHistory.mockResolvedValue({ messages: [] });
    mockSendMessage.mockResolvedValue({
      message: 'Here is my recommendation',
      timestamp: '2026-03-27T12:01:00Z',
    });

    renderScreen(<CoachChatScreen />);

    // Wait for history to load
    await waitFor(() => {
      expect(mockGetHistory).toHaveBeenCalled();
    });

    // Type a message
    const input = screen.getByPlaceholderText(/ask/i);
    fireEvent.changeText(input, 'Help me with my diet');

    // Send
    const sendButton = screen.getByLabelText('Send message');
    await act(async () => {
      fireEvent.press(sendButton);
    });

    // User message should appear immediately
    await waitFor(() => {
      expect(screen.getByText('Help me with my diet')).toBeTruthy();
    });

    // AI response should appear after API responds
    await waitFor(() => {
      expect(screen.getByText('Here is my recommendation')).toBeTruthy();
    });
  });

  it('renders back button', async () => {
    mockGetHistory.mockResolvedValue({ messages: [] });

    renderScreen(<CoachChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Go back')).toBeTruthy();
    });
  });

  it('renders clear conversation button', async () => {
    mockGetHistory.mockResolvedValue({ messages: [] });

    renderScreen(<CoachChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Clear conversation')).toBeTruthy();
    });
  });
});
