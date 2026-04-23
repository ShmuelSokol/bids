-- dbo.gl_inventory_clin_use_1_view



/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */

/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */


/* view gl_inventory_clin_use_1_view: add view */
CREATE VIEW [dbo].[gl_inventory_clin_use_1_view]
AS
SELECT     dbo.inventory_part_clin_use_1_view.*, dbo.gl_transaction_1_view.*
FROM         dbo.inventory_part_clin_use_1_view INNER JOIN
                      dbo.gl_transaction_1_view ON dbo.inventory_part_clin_use_1_view.idnka4_ka4 = dbo.gl_transaction_1_view.idnprm_k94
WHERE     (dbo.gl_transaction_1_view.prmtbl_k94 = 'ka4')


















