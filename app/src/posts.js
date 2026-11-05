import HostPost from './components/HostPost.jsx'
import Post1 from './components/Post1.jsx'
import Post3 from './components/Post3.jsx'

export const POSTS = [
  { id: 1, title: 'What is this? What is what?', subtitle: 'Guess the hidden item', accent: '#FF695C', tint: '#E8E5DE', component: Post1 },
  {
    id: 2, title: 'The art of engineering', subtitle: 'Build the bridge', accent: '#005BFF', tint: '#C8E8FA', component: HostPost,
    intro: [
      'Build a bridge using the set provided. The team shall cross the bridge one by one. +10 fc reward for each member (max 50 fc).',
      'When the task is completed, your host adds the fc to your score.',
    ],
  },
  { id: 3, title: 'Knowledge is king', subtitle: 'Questions & riddles', accent: '#FF695C', tint: '#FAD5CE', component: Post3 },
  {
    id: 4, title: 'Show it, not tell it', subtitle: 'Engineering alias', accent: '#FF695C', tint: '#E8E5DE', component: HostPost,
    intro: [
      'Compete against another team in Engineering Alias. Each win gives the team +5 fc. Your host adds the fc to your score.',
    ],
  },
  {
    id: 5, title: 'Tic-Tac-Run', subtitle: 'Relay tic-tac-toe', accent: '#005BFF', tint: '#C8E8FA', component: HostPost,
    intro: [
      "Tic - Tac - Run! Compete against another team in an intense tic-tac-toe relay. Each win gives you +5 fc from the loser's pot. (Your host will grant you the money.)",
    ],
  },
]
