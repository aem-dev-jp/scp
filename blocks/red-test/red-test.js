/**
 * 切り分け用: 赤文字ブロック（コードバスにブロックが載っているか確認する）
 * @param {Element} block
 */
export default function decorate(block) {
  block.classList.add('red-test');
  if (!block.textContent.trim()) {
    const p = document.createElement('p');
    p.className = 'red-test__fallback';
    p.textContent = 'red-test block loaded (aem-dev-jp/scp). ドキュメント本文を置き換えてください。';
    block.append(p);
  }
}
