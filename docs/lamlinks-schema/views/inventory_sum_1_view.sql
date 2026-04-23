-- dbo.inventory_sum_1_view



/* view inventory_sum_1_view: add view */


/* view inventory_sum_1_view: add view */


/* view inventory_sum_1_view: add view */

/* view inventory_sum_1_view: add view */


/* view inventory_sum_1_view: add view */


/* view inventory_sum_1_view: add view */


/* view inventory_sum_1_view: add view */


/* view inventory_sum_1_view: add view */


/* view inventory_sum_1_view: add view */
CREATE VIEW [dbo].[inventory_sum_1_view]
AS
SELECT        dbo.inventory_part_3_view.fsc_k08, dbo.inventory_part_3_view.niin_k08, dbo.inventory_part_3_view.e_code_mfg, dbo.inventory_part_3_view.prtnum_k71, dbo.inventory_part_3_view.p_desc_k71, 
                         dbo.inventory_part_3_view.idnk93_k93, ISNULL(dbo.inventory_sum_shipment_1_view.dspqty_shp, 0) AS dspqty_shp, ISNULL(dbo.inventory_sum_part_into_make_1_view.dspqty_cmp, 0) AS dspqty_cmp, 
                         ISNULL(dbo.inventory_sum_disposition_1_view.dspqty_dsp, 0) AS dspqty_dsp, ISNULL(dbo.inventory_sum_ship_out_1_view.dspqty_osp, 0) AS dspqty_osp, 
                         ISNULL(dbo.inventory_sum_reserve_1_view.dspqty_rsv, 0) AS dspqty_rsv, dbo.inventory_part_3_view.idnk08_k08, dbo.inventory_part_3_view.idnk71_k71, 
                         ISNULL(dbo.inventory_sum_reserve_1_view.idnk81_k81, 0) AS idnk81_rsv, ISNULL(dbo.inventory_sum_shipment_1_view.idnk81_k81, 0) AS idnk81_shp
FROM            dbo.inventory_part_3_view LEFT OUTER JOIN
                         dbo.inventory_sum_shipment_1_view ON dbo.inventory_part_3_view.idnk93_k93 = dbo.inventory_sum_shipment_1_view.idnk93_k93 LEFT OUTER JOIN
                         dbo.inventory_sum_disposition_1_view ON dbo.inventory_part_3_view.idnk93_k93 = dbo.inventory_sum_disposition_1_view.idnk93_k93 LEFT OUTER JOIN
                         dbo.inventory_sum_reserve_1_view ON dbo.inventory_part_3_view.idnk93_k93 = dbo.inventory_sum_reserve_1_view.idnk93_k93 LEFT OUTER JOIN
                         dbo.inventory_sum_ship_out_1_view ON dbo.inventory_part_3_view.idnk93_k93 = dbo.inventory_sum_ship_out_1_view.idnK93_k93 LEFT OUTER JOIN
                         dbo.inventory_sum_part_into_make_1_view ON dbo.inventory_part_3_view.idnk93_k93 = dbo.inventory_sum_part_into_make_1_view.idnk93_k93









