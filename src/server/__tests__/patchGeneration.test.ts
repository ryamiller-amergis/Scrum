describe('JSON Patch Generation for Due Date', () => {
  describe('Setting due date', () => {
    it('should generate add operation for setting a due date', () => {
      const dueDate = '2024-03-15';
      const patchDocument = [];

      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
        value: dueDate,
      });

      expect(patchDocument).toHaveLength(1);
      expect(patchDocument[0]).toEqual({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
        value: '2024-03-15',
      });
    });
  });

  describe('Clearing due date', () => {
    it('should generate remove operation for clearing a due date', () => {
      const patchDocument = [];

      patchDocument.push({
        op: 'remove',
        path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
      });

      expect(patchDocument).toHaveLength(1);
      expect(patchDocument[0]).toEqual({
        op: 'remove',
        path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
      });
    });
  });
});
