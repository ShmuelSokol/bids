-- dbo.inventory_part_into_make_1_view



/* view inventory_part_into_make_1_view: add view */


/* view inventory_part_into_make_1_view: add view */


/* view inventory_part_into_make_1_view: add view */

/* view inventory_part_into_make_1_view: add view */


/* view inventory_part_into_make_1_view: add view */


/* view inventory_part_into_make_1_view: add view */


/* view inventory_part_into_make_1_view: add view */


/* view inventory_part_into_make_1_view: add view */


/* view inventory_part_into_make_1_view: add view */
CREATE VIEW [dbo].[inventory_part_into_make_1_view]
AS
SELECT        dbo.inventory_part_1_view.fsc_k08, dbo.inventory_part_1_view.niin_k08, dbo.inventory_part_1_view.prtnum_k71, dbo.inventory_part_1_view.p_desc_k71, dbo.inventory_part_1_view.idnk93_k93, 
                         dbo.clin_job_part_1_view.jrqpur_ka9, dbo.ka4_tab.irutbl_ka4, dbo.ka4_tab.dspqty_ka4
FROM            dbo.kab_tab INNER JOIN
                         dbo.clin_job_part_1_view ON dbo.kab_tab.idnkab_kab = dbo.clin_job_part_1_view.idnkab_kab INNER JOIN
                         dbo.ka4_tab ON dbo.kab_tab.idnkab_kab = dbo.ka4_tab.idniru_ka4 INNER JOIN
                         dbo.inventory_part_1_view ON dbo.ka4_tab.idnk93_ka4 = dbo.inventory_part_1_view.idnk93_k93
WHERE        (dbo.clin_job_part_1_view.jrqpur_ka9 = 'make') AND (dbo.ka4_tab.irutbl_ka4 = 'kab')









