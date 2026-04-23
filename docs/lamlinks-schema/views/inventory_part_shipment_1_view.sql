-- dbo.inventory_part_shipment_1_view



/* view inventory_part_shipment_1_view: add view */


/* view inventory_part_shipment_1_view: add view */


/* view inventory_part_shipment_1_view: add view */

/* view inventory_part_shipment_1_view: add view */


/* view inventory_part_shipment_1_view: add view */


/* view inventory_part_shipment_1_view: add view */


/* view inventory_part_shipment_1_view: add view */


/* view inventory_part_shipment_1_view: add view */


/* view inventory_part_shipment_1_view: add view */


/* view inventory_part_shipment_1_view: add view */
/* view inventory_part_shipment_1_view: add view 
 view inventory_part_shipment_1_view: add view 
 view inventory_part_shipment_1_view: add view 
 view inventory_part_shipment_1_view: add view 
 view inventory_part_shipment_1_view: add view 
 view inventory_part_shipment_1_view: add view 
 view inventory_part_shipment_1_view: add view 
 view inventory_part_shipment_1_view: add view */
CREATE VIEW [dbo].[inventory_part_shipment_1_view]
AS
SELECT        dbo.job_line_2_view.cntrct_k79, dbo.job_line_2_view.rel_no_k80, dbo.job_line_2_view.clinno_k81, dbo.inventory_part_1_view.fsc_k08, dbo.inventory_part_1_view.niin_k08, 
                         dbo.inventory_part_1_view.prtnum_k71, dbo.inventory_part_1_view.p_desc_k71, dbo.inventory_part_1_view.e_code_mfg, dbo.ka4_tab.dspqty_ka4, dbo.job_line_2_view.job_no_ka8, 
                         dbo.job_line_2_view.jlnsta_ka9, dbo.job_line_2_view.jlnsdt_ka9, dbo.ka4_tab.postfl_ka4, dbo.ka4_tab.posdte_ka4, dbo.job_line_2_view.shpnum_kaj, dbo.inventory_part_1_view.idnk93_k93, 
                         dbo.ka4_tab.idnka4_ka4, dbo.job_line_2_view.idnk81_k81, dbo.inventory_part_1_view.instat_k93, dbo.job_line_2_view.idnka9_ka9, dbo.inventory_part_1_view.idnk71_k71, dbo.job_line_2_view.piidno_k80
FROM            dbo.job_line_2_view INNER JOIN
                         dbo.kab_tab ON dbo.job_line_2_view.idnkab_kab = dbo.kab_tab.idnkab_kab INNER JOIN
                         dbo.ka4_tab ON dbo.kab_tab.idnkab_kab = dbo.ka4_tab.idniru_ka4 INNER JOIN
                         dbo.inventory_part_1_view ON dbo.ka4_tab.idnk93_ka4 = dbo.inventory_part_1_view.idnk93_k93
WHERE        (dbo.ka4_tab.irutbl_ka4 = 'kab')










